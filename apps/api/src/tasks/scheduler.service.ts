import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ScoringService } from "../scoring/scoring.service";
import { MarketService } from "../market/market.service";
import { ValuationService } from "../market/valuation.service";
import { EconomyService } from "../market/economy.service";
import { createProvider } from "../data-hub/providers/provider.factory";
import { playGameweekRecord } from "../data-hub/sync";
import { HubSyncService } from "../hub/hub-sync.service";

/** Minutos tras el último partido de la jornada en que se reparten puntos y primas (ADR-010). */
const SCORING_DELAY_MIN = 30;

export interface CompetitionTick {
  competition: string;
  timezone: string;
  settledGameweek: number | null;
  playersValued: number;
  leagues: { leagueId: string; signings: number; listed: number }[];
}
export interface TickResult {
  ranAt: string;
  competitions: CompetitionTick[];
}

/**
 * Ciclo temporal automático (ADR-010), sin intervención de admin. Tres disparadores, cada
 * uno en la zona horaria de su competición:
 *  - Snapshot: 30 min antes del primer partido de la jornada (congela alineación + caja).
 *  - Puntos + primas: 30 min después del último partido de la jornada.
 *  - Mercado + valores: a las 00:00 (resolver pujas, revalorizar, rotar agentes libres).
 */
@Injectable()
export class SchedulerService {
  private readonly log = new Logger("Scheduler");
  private readonly provider = createProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly market: MarketService,
    private readonly valuation: ValuationService,
    private readonly economy: EconomyService,
    private readonly hubSync: HubSyncService,
  ) {}

  /** Cobra las cargas de la jornada: salarios + seguro + cuotas de préstamo + blindajes. Idempotente. */
  private async chargeDues(gameweekId: string): Promise<void> {
    await this.market.chargeSalaries(gameweekId);
    await this.economy.chargeInsurancePremiums(gameweekId);
    await this.economy.chargeLoanInstallments(gameweekId);
    await this.economy.chargeShieldRenewals(gameweekId);
  }

  // Serializa TODO el trabajo programado (una sola instancia, ADR-010). Un settle con api-football
  // tarda MINUTOS (throttle 6,5 s/petición), más que el tick por minuto; sin esto, el siguiente tick
  // arrancaría OTRO settle de la misma jornada en paralelo → apariciones corruptas (jugadores a 0),
  // cobros/liquidaciones DOBLES y un backend saturado. Con la cadena, cada tarea espera a la anterior.
  private chain: Promise<unknown> = Promise.resolve();
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn); // corre tras la anterior, aun si esta falló
    this.chain = run.then(() => undefined, () => undefined); // la cadena nunca queda rechazada
    return run as Promise<T>;
  }

  // === Disparadores automáticos ==============================================

  /** Cada minuto: toma snapshots al llegar el deadline y puntúa jornadas ya terminadas. */
  @Cron(CronExpression.EVERY_MINUTE, { name: "snapshot-and-scoring" })
  async minuteTick(): Promise<void> {
    await this.serialize(async () => {
      try {
        await this.snapshotDue();
        await this.scoreDue();
      } catch (e) {
        this.log.error(`minuteTick: ${(e as Error).message}`); // nunca tumbar el proceso
      }
    });
  }

  /** Cada día (05:00): diff del Hub contra el proveedor (altas, club, posición, bajas). ADR-018/019.
   *  Con el mock no hay cambios (idempotente); con api-football cuesta ~21 peticiones. */
  @Cron("0 5 * * *", { name: "hub-daily-diff" })
  async dailyHubDiff(): Promise<void> {
    await this.serialize(async () => {
      try {
        const r = await this.hubSync.detectChanges();
        if (r.total > 0) this.log.log(`Diff diario del Hub: ${r.total} cambios`);
      } catch (e) {
        this.log.warn(`Diff diario del Hub omitido: ${(e as Error).message}`);
      }
    });
  }

  /** Cada hora: en las competiciones donde son las 00:00 locales, cobra salarios (si hoy hay
   *  jornada), resuelve el mercado y revaloriza. */
  @Cron("0 * * * *", { name: "midnight-market" })
  async hourlyMarket(): Promise<void> {
    await this.serialize(async () => {
      try {
        const comps = await this.prisma.competition.findMany();
        for (const comp of comps) {
          if (this.localHour(comp.timezone) === 0) {
            this.log.log(`00:00 en ${comp.name} — salarios, mercado y valores…`);
            await this.chargeSalariesForToday(comp);
            await this.marketAndValues(comp.id);
          }
        }
      } catch (e) {
        this.log.error(`hourlyMarket: ${(e as Error).message}`); // nunca tumbar el proceso
      }
    });
  }

  /** Cobra salarios de la(s) jornada(s) cuyo primer partido es HOY (día local). Idempotente. */
  private async chargeSalariesForToday(comp: { id: string; timezone: string }): Promise<void> {
    const season = await this.prisma.season.findFirst({ where: { competitionId: comp.id, current: true } });
    if (!season) return;
    const gws = await this.prisma.gameweek.findMany({
      where: { seasonId: season.id, status: { not: "FINISHED" } },
      select: { id: true },
    });
    const today = this.localDate(new Date(), comp.timezone);
    for (const gw of gws) {
      const first = await this.firstKickoff(gw.id);
      if (first && this.localDate(first, comp.timezone) === today) {
        await this.chargeDues(gw.id);
      }
    }
  }

  // === Etapas ================================================================

  /** Snapshot de las jornadas cuyo deadline ya pasó y aún no tienen snapshot. */
  private async snapshotDue(): Promise<void> {
    const due = await this.prisma.gameweek.findMany({
      where: { status: { not: "FINISHED" }, deadline: { lte: new Date() } },
      select: { id: true },
    });
    for (const gw of due) {
      const has = await this.prisma.gameweekSnapshot.count({ where: { gameweekId: gw.id } });
      if (has === 0) await this.scoring.snapshotGameweek(gw.id);
    }
  }

  /** Puntúa las jornadas cuyo último partido acabó hace ≥30 min y siguen sin finalizar. */
  private async scoreDue(): Promise<void> {
    const pending = await this.prisma.gameweek.findMany({
      where: { status: { not: "FINISHED" } },
      orderBy: { number: "asc" },
    });
    const cutoff = new Date(Date.now() - SCORING_DELAY_MIN * 60 * 1000);
    for (const gw of pending) {
      const last = await this.lastKickoff(gw.id);
      if (last !== null && last <= cutoff) await this.settleGameweek(gw);
    }
  }

  /** Juega la jornada (Data Hub), puntúa desde el snapshot y reparte primas. */
  private async settleGameweek(gw: { id: string; number: number }): Promise<void> {
    // Re-chequeo defensivo: si ya está finalizada, no la re-liquidamos (evita doble liquidación).
    const fresh = await this.prisma.gameweek.findUnique({ where: { id: gw.id }, select: { status: true } });
    if (fresh?.status === "FINISHED") return;
    await this.scoring.snapshotGameweek(gw.id); // asegura snapshot (no sobreescribe)
    await playGameweekRecord(this.prisma, this.provider, gw); // resultados + eventos → FINISHED
    await this.scoring.computeGameweek(gw.id); // puntos jugador + equipo (desde snapshot)
    await this.scoring.awardPrizes(gw.id); // primas + asistencia (idempotente)
    await this.scoring.payCompensation(gw.id); // compensación por clasificación (catch-up)
    // Asignar promos a los 2 últimos para la SIGUIENTE jornada.
    const settled = await this.prisma.gameweek.findUnique({ where: { id: gw.id }, select: { seasonId: true } });
    if (settled) {
      const next = await this.prisma.gameweek.findFirst({
        where: { seasonId: settled.seasonId, status: { not: "FINISHED" } },
        orderBy: { number: "asc" },
      });
      if (next) await this.scoring.assignPromos(next.id);
    }
    this.log.log(`Jornada ${gw.number} liquidada.`);
  }

  /** Mercado (por liga) + revalorización, para la temporada actual de una competición. */
  private async marketAndValues(competitionId: string): Promise<CompetitionTick["leagues"]> {
    const season = await this.prisma.season.findFirst({ where: { competitionId, current: true } });
    if (!season) return [];
    await this.valuation.refreshValues(season.id);
    const leagues = await this.prisma.league.findMany({ where: { seasonId: season.id }, select: { id: true } });
    const results: CompetitionTick["leagues"] = [];
    for (const l of leagues) {
      const resolved = await this.market.resolveMarket(l.id);
      let listed = 0;
      try {
        listed = (await this.market.generateListings(l.id)).created;
      } catch {
        /* sin agentes libres */
      }
      results.push({ leagueId: l.id, signings: resolved.sales.length, listed });
    }
    return results;
  }

  // === Disparo manual (dev / fast-forward) ====================================

  /** Ejecuta TODO el ciclo a demanda para todas las competiciones. `force` liquida la próxima
   *  jornada aunque aún no se haya jugado (fast-forward de pruebas). */
  async runDailyTick(force: boolean): Promise<TickResult> {
    return this.serialize(() => this.doDailyTick(force));
  }

  private async doDailyTick(force: boolean): Promise<TickResult> {
    const comps = await this.prisma.competition.findMany();
    const competitions: CompetitionTick[] = [];
    for (const comp of comps) {
      const season = await this.prisma.season.findFirst({ where: { competitionId: comp.id, current: true } });
      let settledGameweek: number | null = null;
      if (season) {
        const gw = await this.prisma.gameweek.findFirst({
          where: { seasonId: season.id, status: { not: "FINISHED" } },
          orderBy: { number: "asc" },
        });
        if (gw) {
          const last = await this.lastKickoff(gw.id);
          const due = last !== null && last <= new Date(Date.now() - SCORING_DELAY_MIN * 60 * 1000);
          if (force || due) {
            await this.chargeDues(gw.id); // salario + seguro + cuota (antes del snapshot)
            await this.settleGameweek(gw);
            settledGameweek = gw.number;
          }
        }
      }
      const leagues = await this.marketAndValues(comp.id);
      const playersValued = leagues.length ? await this.countSeasonPlayers(season?.id) : 0;
      competitions.push({ competition: comp.name, timezone: comp.timezone, settledGameweek, playersValued, leagues });
    }
    return { ranAt: new Date().toISOString(), competitions };
  }

  // === Helpers ===============================================================

  private async countSeasonPlayers(seasonId?: string): Promise<number> {
    if (!seasonId) return 0;
    const matches = await this.prisma.match.findMany({ where: { seasonId }, select: { homeTeamId: true, awayTeamId: true } });
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    return this.prisma.player.count({ where: { teamId: { in: teamIds } } });
  }

  private localHour(timeZone: string): number {
    const s = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false, hourCycle: "h23" }).format(new Date());
    return Number(s);
  }

  private async lastKickoff(gameweekId: string): Promise<Date | null> {
    const agg = await this.prisma.match.aggregate({ where: { gameweekId }, _max: { kickoff: true } });
    return agg._max.kickoff;
  }

  private async firstKickoff(gameweekId: string): Promise<Date | null> {
    const agg = await this.prisma.match.aggregate({ where: { gameweekId }, _min: { kickoff: true } });
    return agg._min.kickoff;
  }

  /** Fecha local (YYYY-MM-DD) en una zona horaria. */
  private localDate(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
}
