import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { COMPENSATION_STEP, INSURANCE, PRIZE_PER_POINT, type InsuranceTier } from "../market/economy.rules";
import { attendanceRate } from "../stadium/stadium.rules";
import { CoachScoringService } from "./coach-scoring.service";
import { coachBreakdown, coachPointsFromFacts, COACH_CRITERIA, defaultCoachConfig, mergeCoachConfig } from "./coach.rules";
import { defaultPlayerConfig, mergePlayerConfig, passBandPoints, playerBreakdown, playerPointsFromFacts, PLAYER_CRITERIA } from "./player.rules";
import { Pos } from "./scoring.rules";

const DEFAULT_FORMATION = "4-3-3";

interface MatchForScoring {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  events: { playerId: string | null; type: string; minute: number }[];
  appearances: { playerId: string; started: boolean; minutes: number; stats: unknown }[];
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coachScoring: CoachScoringService,
  ) {}

  // === Ciclo de jornada: lock → (simular en Data Hub) → compute ================

  /** Congela las alineaciones de una jornada (deadline). */
  async lockGameweek(gameweekId: string) {
    const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId } });
    if (!gw) throw new NotFoundException("Jornada no encontrada");
    if (gw.status === "FINISHED") throw new BadRequestException("La jornada ya está finalizada");
    if (gw.status === "LOCKED") return this.gwView(gw);
    const updated = await this.prisma.gameweek.update({
      where: { id: gameweekId },
      data: { status: "LOCKED" },
    });
    return this.gwView(updated);
  }

  /**
   * Calcula y publica los puntos de una jornada YA JUGADA (partidos FINISHED):
   * primero los puntos de cada jugador real, luego el agregado de cada equipo Fantasy.
   * Idempotente (recalcula desde cero).
   */
  async computeGameweek(gameweekId: string) {
    const gw = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
      include: { matches: { include: { events: true, appearances: true } } },
    });
    if (!gw) throw new NotFoundException("Jornada no encontrada");
    if (gw.status !== "FINISHED") {
      throw new BadRequestException("La jornada aún no se ha jugado en el Data Hub");
    }

    await this.ensureSnapshot(gameweekId, gw.seasonId);
    const playerCount = await this.computePlayerScores(gameweekId, gw.matches);
    const coachCount = await this.coachScoring.computeCoachScores(gameweekId);
    const teamCount = await this.computeFantasyScores(gameweekId);

    return {
      gameweek: this.gwView(gw),
      playersScored: playerCount,
      coachesScored: coachCount,
      teamsScored: teamCount,
    };
  }

  // === Hechos y puntos del jugador real (baremo enriquecido, ADR-015) ==========

  private async computePlayerScores(
    gameweekId: string,
    matches: MatchForScoring[],
  ): Promise<number> {
    // Posiciones y equipo de todos los jugadores implicados (aparecen o generan eventos).
    const ids = new Set<string>();
    for (const m of matches) {
      for (const a of m.appearances) ids.add(a.playerId);
      for (const e of m.events) if (e.playerId) ids.add(e.playerId);
    }
    const players = await this.prisma.player.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, position: true, teamId: true },
    });
    const meta = new Map(players.map((p) => [p.id, p]));

    // Hechos crudos por jugador (se GUARDAN; el baremo se aplica por liga al agregar).
    const factsOf = new Map<string, Record<string, number>>();
    const posOf = new Map<string, Pos>();
    const getFacts = (id: string): Record<string, number> => {
      let f = factsOf.get(id);
      if (!f) {
        f = {};
        factsOf.set(id, f);
        posOf.set(id, (meta.get(id)?.position as Pos) ?? "MID");
      }
      return f;
    };

    for (const m of matches) {
      this.accumulateMatchFacts(m, meta, getFacts);
    }

    const cfg = defaultPlayerConfig();
    const rows = [...factsOf.entries()].map(([playerId, facts]) => {
      for (const k of Object.keys(facts)) if (facts[k] === 0) delete facts[k]; // sin ruido de ceros
      return {
        playerId,
        gameweekId,
        points: playerPointsFromFacts(facts, posOf.get(playerId) ?? "MID", cfg),
        breakdown: facts, // HECHOS crudos (cantidades), no puntos: el baremo se aplica por liga
      };
    });

    // Idempotente: recomputar desde cero.
    await this.prisma.playerGameweekScore.deleteMany({ where: { gameweekId } });
    if (rows.length) await this.prisma.playerGameweekScore.createMany({ data: rows });
    return rows.length;
  }

  /** Vuelca los HECHOS de un partido (eventos + stats + contexto) en los acumuladores por jugador. */
  private accumulateMatchFacts(
    m: MatchForScoring,
    meta: Map<string, { id: string; position: string; teamId: string | null }>,
    getFacts: (id: string) => Record<string, number>,
  ): void {
    const add = (id: string, key: string, qty: number) => {
      if (qty === 0) return;
      const f = getFacts(id);
      f[key] = (f[key] ?? 0) + qty;
    };
    const teamOf = (id: string) => meta.get(id)?.teamId;
    const homeId = m.homeTeamId;
    const awayId = m.awayTeamId;

    // --- Cronología de goles (para gol decisivo, portería a cero y resultado del portero) ---
    // Cada gol suma a un equipo: GOAL/PEN_SCORED al equipo del autor; OWN_GOAL al rival.
    const goals = m.events
      .filter((e) => e.type === "GOAL" || e.type === "PEN_SCORED" || e.type === "OWN_GOAL")
      .map((e) => {
        const ownTeam = e.playerId ? teamOf(e.playerId) : undefined;
        const scoringTeam = e.type === "OWN_GOAL" ? (ownTeam === homeId ? awayId : homeId) : ownTeam;
        return { minute: e.minute, team: scoringTeam, scorer: e.type === "OWN_GOAL" ? null : e.playerId, type: e.type };
      })
      .filter((g) => g.team)
      .sort((a, b) => a.minute - b.minute);

    // Gol decisivo (nota *2): el que otorga la PRIMERA ventaja al ganador. SUSTITUYE al gol
    // base (9 en vez de 7/5); el tiro a puerta asociado se mantiene aparte.
    const finalHome = m.homeGoals ?? 0;
    const finalAway = m.awayGoals ?? 0;
    if (finalHome !== finalAway) {
      const winner = finalHome > finalAway ? homeId : awayId;
      let hs = 0;
      let as = 0;
      for (const g of goals) {
        if (g.team === homeId) hs++;
        else as++;
        const lead = winner === homeId ? hs - as : as - hs;
        if (lead === 1) {
          if (g.scorer) {
            add(g.scorer, "decisiveGoal", 1);
            add(g.scorer, g.type === "PEN_SCORED" ? "penScored" : "goal", -1); // el decisivo no cuenta además como gol base
          }
          break;
        }
      }
    }

    // Goles encajados por minuto para cada equipo (los del rival).
    const concededByTeamUpTo = (team: string | null | undefined, minute: number) =>
      goals.filter((g) => g.team && g.team !== team && g.minute <= minute).length;
    const scoreAt = (minute: number) => {
      let hs = 0;
      let as = 0;
      for (const g of goals) {
        if (g.minute > minute) break;
        if (g.team === homeId) hs++;
        else as++;
      }
      return { hs, as };
    };

    // --- Eventos discretos por jugador ---
    const yellowOf = new Map<string, number>();
    const redOf = new Set<string>();
    for (const e of m.events) {
      if (!e.playerId || !meta.has(e.playerId)) continue;
      switch (e.type) {
        case "GOAL":
          add(e.playerId, "goal", 1);
          break;
        case "PEN_SCORED":
          add(e.playerId, "penScored", 1);
          break;
        case "OWN_GOAL":
          add(e.playerId, "ownGoal", 1);
          break;
        case "ASSIST":
          add(e.playerId, "assist", 1);
          break;
        case "PEN_MISSED":
          add(e.playerId, "penMissed", 1);
          break;
        case "PEN_SAVED":
          add(e.playerId, "penSaved", 1);
          break;
        case "YELLOW":
          yellowOf.set(e.playerId, (yellowOf.get(e.playerId) ?? 0) + 1);
          break;
        case "RED":
          redOf.add(e.playerId);
          break;
      }
    }
    // Tarjetas (nota *7/*12): roja directa vs doble amarilla; amarillas sueltas si no expulsan.
    const cardIds = new Set<string>([...yellowOf.keys(), ...redOf]);
    for (const id of cardIds) {
      const y = yellowOf.get(id) ?? 0;
      if (redOf.has(id)) {
        if (y >= 2) {
          add(id, "doubleYellow", 1);
          add(id, "yellow", y - 2);
        } else {
          add(id, "redDirect", 1);
          add(id, "yellow", y);
        }
      } else {
        add(id, "yellow", y);
      }
    }

    // --- Estadísticas de conteo por aparición + contexto por posición ---
    const STAT_MAP: Record<string, string> = {
      shotsOnTarget: "shotOnTarget",
      shotsWoodwork: "shotWoodwork",
      accurateCrosses: "accurateCross",
      interceptions: "interception",
      tackles: "tackle",
      tacklesLastMan: "tackleLastMan",
      errorLeadingToGoal: "errorGoal",
      bigChancesCreated: "bigChanceCreated",
      bigChancesMissed: "bigChanceMissed",
      penaltiesConceded: "penConceded",
      penaltiesWon: "penWon",
      foulsWon: "foulWon",
      foulsCommitted: "foulCommitted",
      goalLineClearance: "goalLineClearance",
      saves: "save",
      crossesClaimed: "crossClaimed",
    };
    for (const app of m.appearances) {
      const p = meta.get(app.playerId);
      if (!p) continue;
      const pos = p.position as Pos;
      const stats = (app.stats ?? {}) as Record<string, number>;
      for (const [statKey, critKey] of Object.entries(STAT_MAP)) {
        if (stats[statKey]) add(app.playerId, critKey, stats[statKey]);
      }
      if (stats.dribbles) add(app.playerId, "dribblesPer2", Math.floor(stats.dribbles / 2));
      if (pos === "MID" && typeof stats.passPct === "number") {
        const band = passBandPoints(stats.passPct);
        if (band !== 0) add(app.playerId, "passBand", band); // criterio `raw` (puntos firmados)
      }

      // Contexto por minutos: portería a cero, goles recibidos y resultado del portero.
      const exit = app.started ? app.minutes : 90; // minuto en que abandona (titular) o fin
      const conceded = concededByTeamUpTo(p.teamId, exit);
      if ((pos === "GK" || pos === "DEF") && app.started && app.minutes >= 75 && conceded === 0) {
        add(app.playerId, pos === "GK" ? "cleanSheetGK" : "cleanSheetDef", 1); // nota *9
      }
      if (pos === "GK" && app.started) {
        if (conceded > 0) add(app.playerId, "concededPerGoal", conceded);
        if (app.minutes >= 45) {
          // Resultado del portero al abandonar el campo (nota *11).
          const { hs, as } = scoreAt(exit);
          const my = p.teamId === homeId ? hs : as;
          const opp = p.teamId === homeId ? as : hs;
          add(app.playerId, my > opp ? "gkWin" : my < opp ? "gkLoss" : "gkDraw", 1);
        }
      }
    }
  }

  // === Snapshot (alineación + caja congeladas, ADR-010) ========================

  /** Congela alineación y caja de cada equipo para la jornada. No hace nada si ya existe. */
  async snapshotGameweek(gameweekId: string): Promise<number> {
    const gw = await this.prisma.gameweek.findUnique({
      where: { id: gameweekId },
      select: { id: true, seasonId: true, status: true },
    });
    if (!gw) throw new NotFoundException("Jornada no encontrada");
    if (gw.status === "FINISHED") return 0; // ya jugada: el snapshot está congelado
    const existing = await this.prisma.gameweekSnapshot.count({ where: { gameweekId } });
    if (existing > 0) return existing; // ya se tomó (en el deadline); no se sobreescribe
    return this.writeSnapshot(gameweekId, gw.seasonId);
  }

  private async ensureSnapshot(gameweekId: string, seasonId: string): Promise<void> {
    const existing = await this.prisma.gameweekSnapshot.count({ where: { gameweekId } });
    if (existing === 0) await this.writeSnapshot(gameweekId, seasonId);
  }

  private async writeSnapshot(gameweekId: string, seasonId: string): Promise<number> {
    const teams = await this.prisma.fantasyTeam.findMany({
      where: { membership: { league: { seasonId } } },
      select: { id: true, budget: true },
    });
    const lineups = await this.prisma.fantasyLineup.findMany({
      where: { gameweekId, fantasyTeamId: { in: teams.map((t) => t.id) } },
      include: { slots: { orderBy: { order: "asc" } } },
    });
    const lineupOf = new Map(lineups.map((l) => [l.fantasyTeamId, l]));

    const rows = teams.map((t) => {
      const l = lineupOf.get(t.id);
      return {
        fantasyTeamId: t.id,
        gameweekId,
        formation: l?.formation ?? DEFAULT_FORMATION,
        captainId: l?.captainId ?? null,
        coachId: l?.coachId ?? null,
        starters: l ? l.slots.filter((s) => s.role === "STARTER").map((s) => s.playerId) : [],
        bench: l ? l.slots.filter((s) => s.role === "BENCH").map((s) => s.playerId) : [],
        cash: t.budget,
        eligible: t.budget >= 0,
      };
    });
    await this.prisma.gameweekSnapshot.deleteMany({ where: { gameweekId } });
    if (rows.length) await this.prisma.gameweekSnapshot.createMany({ data: rows });
    return rows.length;
  }

  // === Puntos del equipo Fantasy (agrega el SNAPSHOT de la alineación) ==========

  private async computeFantasyScores(gameweekId: string): Promise<number> {
    const snapshots = await this.prisma.gameweekSnapshot.findMany({ where: { gameweekId } });
    if (snapshots.length === 0) {
      await this.prisma.fantasyGameweekScore.deleteMany({ where: { gameweekId } });
      return 0;
    }

    // Hechos crudos del jugador; el baremo (valores/activación) se aplica POR LIGA (ADR-015).
    const scoreRows = await this.prisma.playerGameweekScore.findMany({
      where: { gameweekId },
      select: { playerId: true, breakdown: true },
    });
    const playerFactsOf = new Map(scoreRows.map((s) => [s.playerId, (s.breakdown ?? {}) as Record<string, number>]));

    const apps = await this.prisma.appearance.findMany({
      where: { match: { gameweekId }, minutes: { gt: 0 } },
      select: { playerId: true },
    });
    const played = new Set(apps.map((a) => a.playerId));

    // Hechos de entrenadores de la jornada; el baremo se aplica POR LIGA (ADR-014/Fase 2).
    const coachScores = await this.prisma.coachGameweekScore.findMany({
      where: { gameweekId },
      select: { coachId: true, breakdown: true },
    });
    const coachFactsOf = new Map(coachScores.map((c) => [c.coachId, (c.breakdown ?? {}) as Record<string, number>]));
    const teamCfg = await this.prisma.fantasyTeam.findMany({
      where: { id: { in: snapshots.map((s) => s.fantasyTeamId) } },
      select: {
        id: true,
        membership: {
          select: { league: { select: { settings: { select: { coachCriteria: true, playerCriteria: true } } } } },
        },
      },
    });
    const coachConfigOf = new Map(teamCfg.map((t) => [t.id, mergeCoachConfig(t.membership?.league.settings?.coachCriteria)]));
    const playerConfigOf = new Map(teamCfg.map((t) => [t.id, mergePlayerConfig(t.membership?.league.settings?.playerCriteria)]));

    // Seguro médico: jugadores lesionados en la jornada + pólizas por equipo (ADR-012).
    const injuryEvents = await this.prisma.matchEvent.findMany({
      where: { match: { gameweekId }, type: "INJURY", playerId: { not: null } },
      select: { playerId: true },
    });
    const injured = new Set(injuryEvents.map((e) => e.playerId!));
    const policies = await this.prisma.playerInsurance.findMany({ select: { fantasyTeamId: true, playerId: true, tier: true } });
    const insuranceBonusOf = new Map(
      policies.map((p) => [`${p.fantasyTeamId}:${p.playerId}`, INSURANCE[p.tier as InsuranceTier].bonus]),
    );

    const allIds = [...new Set(snapshots.flatMap((s) => [...s.starters, ...s.bench]))];
    const posRows = await this.prisma.player.findMany({
      where: { id: { in: allIds } },
      select: { id: true, position: true },
    });
    const posOf = new Map(posRows.map((p) => [p.id, p.position as Pos]));

    // Promos de catch-up de esta jornada (capitán triple / puntos ×2).
    const promos = await this.prisma.teamPromo.findMany({ where: { gameweekId }, select: { fantasyTeamId: true, kind: true } });
    const promoOf = new Map(promos.map((p) => [p.fantasyTeamId, p.kind]));

    const results: { fantasyTeamId: string; gameweekId: string; points: number; eligible: boolean }[] = [];
    for (const snap of snapshots) {
      // Sustituciones automáticas por misma posición (el titular que no jugó entra el 1er
      // suplente disponible de su posición que sí jugó).
      const usedBench = new Set<string>();
      const effective: string[] = [];
      for (const s of snap.starters) {
        if (played.has(s)) {
          effective.push(s);
          continue;
        }
        const pos = posOf.get(s);
        const sub = snap.bench.find((b) => !usedBench.has(b) && played.has(b) && posOf.get(b) === pos);
        if (sub) {
          usedBench.add(sub);
          effective.push(sub);
        } else {
          effective.push(s);
        }
      }
      const promo = promoOf.get(snap.fantasyTeamId);
      const pcfg = playerConfigOf.get(snap.fantasyTeamId) ?? defaultPlayerConfig();
      const ptsFor = (id: string) => playerPointsFromFacts(playerFactsOf.get(id) ?? {}, posOf.get(id) ?? "MID", pcfg);
      let points = effective.reduce((sum, id) => sum + ptsFor(id), 0);
      if (snap.captainId && effective.includes(snap.captainId) && played.has(snap.captainId)) {
        // Capitán ×2 normal; ×3 con promo TRIPLE_CAPTAIN (copias extra sobre la base ya contada).
        const extra = promo === "TRIPLE_CAPTAIN" ? 2 : 1;
        points += extra * ptsFor(snap.captainId);
      }
      // El entrenador elegido aporta sus puntos (según el baremo de la liga) al total.
      if (snap.coachId) {
        const config = coachConfigOf.get(snap.fantasyTeamId) ?? defaultCoachConfig();
        points += coachPointsFromFacts(coachFactsOf.get(snap.coachId) ?? {}, config);
      }
      // Seguro médico: un titular efectivo asegurado que se lesionó suma su bonus.
      for (const id of effective) {
        if (injured.has(id) && insuranceBonusOf.has(`${snap.fantasyTeamId}:${id}`)) {
          points += insuranceBonusOf.get(`${snap.fantasyTeamId}:${id}`)!;
        }
      }
      // Promo puntos ×2.
      if (promo === "DOUBLE_POINTS") points *= 2;
      results.push({ fantasyTeamId: snap.fantasyTeamId, gameweekId, points, eligible: snap.eligible });
    }

    await this.prisma.fantasyGameweekScore.deleteMany({ where: { gameweekId } });
    if (results.length) await this.prisma.fantasyGameweekScore.createMany({ data: results });
    return results.length;
  }

  /**
   * Asegura que la prima (€/punto) y el ingreso por asistencia de la jornada son los CORRECTOS
   * según los puntos ACTUALES de cada equipo. En el reparto inicial paga el total; al RECALCULAR
   * (re-ingesta / recompute) reajusta por la DIFERENCIA respecto a lo ya pagado y deja constancia
   * con transacciones "(reajuste)". Repetible: si nada cambió, delta 0 → no hace nada.
   */
  async awardPrizes(gameweekId: string): Promise<number> {
    const scores = await this.prisma.fantasyGameweekScore.findMany({
      where: { gameweekId },
      select: { fantasyTeamId: true, points: true },
    });
    if (scores.length === 0) return 0;
    const teamIds = scores.map((s) => s.fantasyTeamId);

    // Nivel de estadio de cada equipo → ingreso por asistencia (€/punto).
    const stadiums = await this.prisma.stadium.findMany({ where: { fantasyTeamId: { in: teamIds } }, select: { fantasyTeamId: true, level: true } });
    const levelOf = new Map(stadiums.map((s) => [s.fantasyTeamId, s.level]));
    const promos = await this.prisma.teamPromo.findMany({ where: { gameweekId, kind: "DOUBLE_PRIZE" }, select: { fantasyTeamId: true } });
    const doublePrize = new Set(promos.map((p) => p.fantasyTeamId));
    // Prima por punto según la config de la LIGA de cada equipo (ADR-014).
    const cfg = await this.prisma.fantasyTeam.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, membership: { select: { league: { select: { settings: { select: { prizePerPoint: true } } } } } } },
    });
    const prizePerPointOf = new Map(cfg.map((t) => [t.id, t.membership?.league.settings?.prizePerPoint ?? PRIZE_PER_POINT]));

    // Lo YA pagado por esta jornada (para reajustar por diferencia al recalcular).
    const paidRows = await this.prisma.transaction.groupBy({
      by: ["fantasyTeamId", "type"],
      where: { gameweekId, type: { in: ["PRIZE", "STADIUM"] } },
      _sum: { amount: true },
    });
    const paidOf = new Map<string, number>();
    for (const r of paidRows) paidOf.set(`${r.fantasyTeamId}:${r.type}`, r._sum.amount ?? 0);

    let changed = 0;
    for (const s of scores) {
      const pts = Math.max(0, s.points);
      const targetPrize = pts * (prizePerPointOf.get(s.fantasyTeamId) ?? PRIZE_PER_POINT) * (doublePrize.has(s.fantasyTeamId) ? 2 : 1);
      const targetAtt = Math.round(pts * attendanceRate(levelOf.get(s.fantasyTeamId) ?? 0));
      const oldPrize = paidOf.get(`${s.fantasyTeamId}:PRIZE`) ?? 0;
      const oldAtt = paidOf.get(`${s.fantasyTeamId}:STADIUM`) ?? 0;
      const dPrize = targetPrize - oldPrize;
      const dAtt = targetAtt - oldAtt;
      if (dPrize === 0 && dAtt === 0) continue;

      const ops = [
        this.prisma.fantasyTeam.update({ where: { id: s.fantasyTeamId }, data: { budget: { increment: dPrize + dAtt } } }),
      ];
      if (dPrize !== 0)
        ops.push(
          this.prisma.transaction.create({
            data: { fantasyTeamId: s.fantasyTeamId, type: "PRIZE", amount: dPrize, gameweekId, description: oldPrize === 0 ? "Prima por puntos de jornada" : "Prima por puntos de jornada (reajuste)" },
          }) as never,
        );
      if (dAtt !== 0)
        ops.push(
          this.prisma.transaction.create({
            data: { fantasyTeamId: s.fantasyTeamId, type: "STADIUM", amount: dAtt, gameweekId, description: oldAtt === 0 ? "Ingreso por asistencia" : "Ingreso por asistencia (reajuste)" },
          }) as never,
        );
      await this.prisma.$transaction(ops);
      changed++;
    }
    return changed;
  }

  /** Compensación por clasificación (catch-up): (puesto−1) × paso, tras cada jornada. El
   *  último cobra más para poder pujar y escalar. Idempotente por jornada. */
  async payCompensation(gameweekId: string): Promise<number> {
    const already = await this.prisma.transaction.count({ where: { gameweekId, type: "COMPENSATION" } });
    if (already > 0) return 0;
    const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId }, select: { seasonId: true } });
    if (!gw) return 0;
    // Compensación POR LIGA (cada liga tiene su clasificación y su paso). ADR-014.
    const leagues = await this.prisma.league.findMany({
      where: { seasonId: gw.seasonId },
      select: { id: true, settings: { select: { compensationStep: true } } },
    });
    let paid = 0;
    for (const league of leagues) {
      const step = league.settings?.compensationStep ?? COMPENSATION_STEP;
      const ranked = await this.cumulativeRanking(league.id);
      for (let i = 0; i < ranked.length; i++) {
        const comp = i * step; // 1º (i=0) → 0; último → (n-1)×paso
        if (comp <= 0) continue;
        await this.prisma.$transaction([
          this.prisma.fantasyTeam.update({ where: { id: ranked[i] }, data: { budget: { increment: comp } } }),
          this.prisma.transaction.create({
            data: { fantasyTeamId: ranked[i], type: "COMPENSATION", amount: comp, gameweekId, description: `Compensación (${i + 1}º)` },
          }),
        ]);
        paid++;
      }
    }
    return paid;
  }

  /** Asigna promos random a los 2 últimos de CADA liga para la jornada dada (catch-up). */
  async assignPromos(gameweekId: string): Promise<void> {
    const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId }, select: { seasonId: true, status: true } });
    if (!gw || gw.status === "FINISHED") return;
    const existing = await this.prisma.teamPromo.count({ where: { gameweekId } });
    if (existing > 0) return;
    const leagues = await this.prisma.league.findMany({ where: { seasonId: gw.seasonId }, select: { id: true } });
    const kinds = ["DOUBLE_PRIZE", "NO_SALARY", "TRIPLE_CAPTAIN", "DOUBLE_POINTS"] as const;
    for (const league of leagues) {
      const bottom2 = (await this.cumulativeRanking(league.id)).slice(-2);
      for (const teamId of bottom2) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        await this.prisma.teamPromo.upsert({
          where: { fantasyTeamId_gameweekId: { fantasyTeamId: teamId, gameweekId } },
          create: { fantasyTeamId: teamId, gameweekId, kind },
          update: { kind },
        });
      }
    }
  }

  /** IDs de equipos de una LIGA ordenados por puntos acumulados (elegibles), mejor primero. */
  private async cumulativeRanking(leagueId: string): Promise<string[]> {
    const teams = await this.prisma.fantasyTeam.findMany({
      where: { membership: { leagueId } },
      select: { id: true, gwScores: { select: { points: true, eligible: true } } },
    });
    return teams
      .map((t) => ({ id: t.id, pts: t.gwScores.reduce((s, g) => s + (g.eligible ? g.points : 0), 0) }))
      .sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id))
      .map((t) => t.id);
  }

  // === Lectura: clasificación y resultado del equipo ===========================

  async getStandings(userId: string, leagueId: string) {
    await this.assertMember(userId, leagueId);
    const teams = await this.prisma.fantasyTeam.findMany({
      where: { membership: { leagueId } },
      include: {
        membership: { include: { user: { select: { displayName: true } } } },
        gwScores: { select: { points: true, eligible: true } },
      },
    });
    const rows = teams
      .map((t) => ({
        teamId: t.id,
        teamName: t.name,
        manager: t.membership.user.displayName,
        played: t.gwScores.filter((g) => g.eligible).length,
        // Los equipos en números rojos no suman a la clasificación esa jornada.
        points: t.gwScores.reduce((s, g) => s + (g.eligible ? g.points : 0), 0),
      }))
      .sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName))
      .map((r, i) => ({ rank: i + 1, ...r }));
    return rows;
  }

  async getTeamGameweek(userId: string, leagueId: string, gameweekId: string) {
    const { teamId } = await this.assertMember(userId, leagueId);
    const lineup = await this.prisma.fantasyLineup.findUnique({
      where: { fantasyTeamId_gameweekId: { fantasyTeamId: teamId, gameweekId } },
      include: { slots: { orderBy: { order: "asc" } } },
    });
    if (!lineup) throw new NotFoundException("No hay alineación para esa jornada");

    const ids = lineup.slots.map((s) => s.playerId);
    const [scores, players, total, settings] = await Promise.all([
      this.prisma.playerGameweekScore.findMany({
        where: { gameweekId, playerId: { in: ids } },
        select: { playerId: true, breakdown: true },
      }),
      this.prisma.player.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, position: true },
      }),
      this.prisma.fantasyGameweekScore.findUnique({
        where: { fantasyTeamId_gameweekId: { fantasyTeamId: teamId, gameweekId } },
        select: { points: true },
      }),
      this.prisma.leagueSettings.findUnique({ where: { leagueId }, select: { playerCriteria: true, coachCriteria: true } }),
    ]);
    const factsOf = new Map(scores.map((s) => [s.playerId, (s.breakdown ?? {}) as Record<string, number>]));
    const nameOf = new Map(players.map((p) => [p.id, p]));
    // Puntos del jugador SEGÚN el baremo de esta liga (ADR-015).
    const cfg = mergePlayerConfig(settings?.playerCriteria);
    const critLabel = new Map(PLAYER_CRITERIA.map((c) => [c.key, c.label]));
    const line = (id: string) => {
      const facts = factsOf.get(id) ?? {};
      const pos = (nameOf.get(id)?.position as Pos) ?? "MID";
      // Desglose exacto: qué concepto sumó/restó cuántos puntos (con la cantidad del hecho).
      const breakdown = Object.entries(playerBreakdown(facts, pos, cfg))
        .map(([key, points]) => ({ key, label: critLabel.get(key) ?? key, qty: facts[key] ?? 0, points }))
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
      return {
        id,
        name: nameOf.get(id)?.name ?? "?",
        position: nameOf.get(id)?.position ?? "?",
        points: playerPointsFromFacts(facts, pos, cfg),
        isCaptain: id === lineup.captainId,
        breakdown,
      };
    };

    // Entrenador alineado: sus puntos y desglose por concepto (mismo baremo de la liga).
    let coach: { id: string; name: string; points: number; breakdown: { key: string; label: string; qty: number; points: number }[] } | null = null;
    if (lineup.coachId) {
      const [cScore, cRow] = await Promise.all([
        this.prisma.coachGameweekScore.findUnique({
          where: { coachId_gameweekId: { coachId: lineup.coachId, gameweekId } },
          select: { breakdown: true },
        }),
        this.prisma.coach.findUnique({ where: { id: lineup.coachId }, select: { name: true } }),
      ]);
      const cfacts = (cScore?.breakdown ?? {}) as Record<string, number>;
      const ccfg = mergeCoachConfig(settings?.coachCriteria);
      const cLabel = new Map(COACH_CRITERIA.map((c) => [c.key, c.label]));
      const cbd = Object.entries(coachBreakdown(cfacts, ccfg))
        .map(([key, points]) => ({ key, label: cLabel.get(key) ?? key, qty: cfacts[key] ?? 0, points }))
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
      coach = { id: lineup.coachId, name: cRow?.name ?? "Entrenador", points: coachPointsFromFacts(cfacts, ccfg), breakdown: cbd };
    }

    return {
      gameweekId,
      formation: lineup.formation,
      total: total?.points ?? null,
      starters: lineup.slots.filter((s) => s.role === "STARTER").map((s) => line(s.playerId)),
      bench: lineup.slots.filter((s) => s.role === "BENCH").map((s) => line(s.playerId)),
      coach,
    };
  }

  /** Registro de jornadas del equipo del usuario en la liga: nº, estado, deadline y puntos. */
  async getTeamGameweeks(userId: string, leagueId: string) {
    const { teamId } = await this.assertMember(userId, leagueId);
    const league = await this.prisma.league.findUnique({ where: { id: leagueId }, select: { seasonId: true } });
    if (!league) throw new NotFoundException("Liga no encontrada");
    const [gws, scores] = await Promise.all([
      this.prisma.gameweek.findMany({
        where: { seasonId: league.seasonId },
        orderBy: { number: "asc" },
        select: { id: true, number: true, status: true, deadline: true },
      }),
      this.prisma.fantasyGameweekScore.findMany({
        where: { fantasyTeamId: teamId },
        select: { gameweekId: true, points: true, eligible: true },
      }),
    ]);
    const scoreOf = new Map(scores.map((s) => [s.gameweekId, s]));
    return gws.map((g) => ({
      gameweekId: g.id,
      number: g.number,
      status: g.status,
      deadline: g.deadline,
      points: scoreOf.get(g.id)?.points ?? null,
      eligible: scoreOf.get(g.id)?.eligible ?? null,
    }));
  }

  // === Helpers =================================================================

  private async assertMember(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { fantasyTeam: { select: { id: true } } },
    });
    if (!membership) throw new ForbiddenException("No perteneces a esta liga");
    return { teamId: membership.fantasyTeam?.id ?? "" };
  }

  private gwView(gw: { id: string; number: number; status: string }) {
    return { id: gw.id, number: gw.number, status: gw.status };
  }
}
