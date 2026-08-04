import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { PlayerLifecycleService } from "../hub/player-lifecycle.service";
import { HubSyncService } from "../hub/hub-sync.service";
import { createProvider } from "../data-hub/providers/provider.factory";
import { backfill as runBackfill, playGameweekRecord } from "../data-hub/sync";
import { ScoringService } from "../scoring/scoring.service";

const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
type Position = (typeof POSITIONS)[number];

/**
 * God-mode del Hub (ADR-016). Correcciones quirúrgicas: NO disparan efectos de negocio en
 * cascada (primas, mercado…). El dinero se mueve siempre con una `Transaction`. Toda acción
 * deja traza en `AdminAction`.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly lifecycle: PlayerLifecycleService,
    private readonly hubSync: HubSyncService,
  ) {}

  // Estado de la última tarea larga del Hub (backfill/play/sync). En memoria: el admin lo consulta.
  private hubJob: { name: string; status: "running" | "done" | "error"; message: string; at: string } | null = null;

  /** Lanza una tarea larga en segundo plano (no bloquea la respuesta HTTP; el admin ve el estado). */
  private startJob(name: string, fn: () => Promise<unknown>) {
    if (this.hubJob?.status === "running") throw new BadRequestException(`Ya hay una tarea en curso: ${this.hubJob.name}`);
    this.hubJob = { name, status: "running", message: "En curso…", at: new Date().toISOString() };
    void fn()
      .then((r) => { this.hubJob = { name, status: "done", message: JSON.stringify(r ?? {}).slice(0, 400), at: new Date().toISOString() }; })
      .catch((e) => { this.hubJob = { name, status: "error", message: (e as Error).message, at: new Date().toISOString() }; });
    return { started: true, job: name };
  }

  private audit(adminId: string, action: string, target: string | null, detail: unknown) {
    return this.prisma.adminAction.create({
      data: { adminId, action, target, detail: (detail ?? {}) as object },
    });
  }

  // === Lectura para el panel ===================================================

  async overview() {
    const [leagues, teams, gameweeks] = await Promise.all([
      this.prisma.league.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
      this.prisma.fantasyTeam.findMany({
        select: { id: true, name: true, budget: true, membership: { select: { leagueId: true, league: { select: { name: true } }, user: { select: { displayName: true } } } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.gameweek.findMany({ select: { id: true, number: true, status: true }, orderBy: { number: "asc" } }),
    ]);
    return {
      leagues,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        budget: t.budget,
        leagueId: t.membership.leagueId,
        league: t.membership.league.name,
        manager: t.membership.user.displayName,
      })),
      gameweeks,
    };
  }

  async teamDetail(teamId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        budget: true,
        membership: { select: { leagueId: true } },
        roster: { select: { playerId: true, purchasePrice: true, player: { select: { name: true, position: true, value: true, rating: true } } } },
        rosterCoaches: { select: { coachId: true, purchasePrice: true, coach: { select: { name: true, value: true } } } },
        transactions: { orderBy: { createdAt: "desc" }, take: 15, select: { id: true, type: true, amount: true, description: true, createdAt: true } },
      },
    });
    if (!team) throw new NotFoundException("Equipo no encontrado");
    return {
      id: team.id,
      name: team.name,
      budget: team.budget,
      leagueId: team.membership.leagueId,
      players: team.roster.map((r) => ({ playerId: r.playerId, name: r.player.name, position: r.player.position, value: r.player.value, rating: r.player.rating, purchasePrice: r.purchasePrice })),
      coaches: team.rosterCoaches.map((r) => ({ coachId: r.coachId, name: r.coach.name, value: r.coach.value, purchasePrice: r.purchasePrice })),
      transactions: team.transactions,
    };
  }

  async listAudit() {
    const rows = await this.prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, action: true, target: true, detail: true, createdAt: true, admin: { select: { displayName: true, email: true } } },
    });
    return rows.map((r) => ({ ...r, admin: r.admin.displayName || r.admin.email }));
  }

  // === Overrides ===============================================================

  /** Da/quita dinero a un equipo (siempre con Transaction ADJUST). */
  async adjustMoney(adminId: string, teamId: string, amount: number, reason?: string) {
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException("Importe inválido");
    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, select: { id: true, budget: true } });
    if (!team) throw new NotFoundException("Equipo no encontrado");
    const [updated] = await this.prisma.$transaction([
      this.prisma.fantasyTeam.update({ where: { id: teamId }, data: { budget: { increment: Math.round(amount) } }, select: { budget: true } }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: teamId, type: "ADJUST", amount: Math.round(amount), description: reason ?? "Ajuste del administrador" },
      }),
    ]);
    await this.audit(adminId, "team.money", teamId, { amount: Math.round(amount), reason, budgetAfter: updated.budget });
    return { teamId, budget: updated.budget };
  }

  /** Edita un jugador (datos maestros del Hub): nombre, posición, club, rating, valor. */
  async updatePlayer(adminId: string, playerId: string, dto: { name?: string; position?: string; teamId?: string | null; rating?: number; value?: number }) {
    const before = await this.prisma.player.findUnique({ where: { id: playerId }, select: { name: true, position: true, teamId: true, rating: true, value: true } });
    if (!before) throw new NotFoundException("Jugador no encontrado");
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.position !== undefined) {
      if (!POSITIONS.includes(dto.position as Position)) throw new BadRequestException("Posición inválida");
      data.position = dto.position;
    }
    if (dto.teamId !== undefined) data.teamId = dto.teamId;
    if (dto.rating !== undefined) data.rating = Math.max(40, Math.min(99, Math.round(dto.rating)));
    if (dto.value !== undefined) data.value = Math.max(0, Math.round(dto.value));
    if (Object.keys(data).length === 0) throw new BadRequestException("Nada que actualizar");
    const after = await this.prisma.player.update({ where: { id: playerId }, data, select: { id: true, name: true, position: true, teamId: true, rating: true, value: true } });
    await this.audit(adminId, "player.update", playerId, { before, after });
    return after;
  }

  /** Alta de un jugador en un club real. */
  async createPlayer(adminId: string, dto: { name: string; position: string; teamId: string; rating?: number }) {
    if (!dto.name || !dto.teamId) throw new BadRequestException("Nombre y club son obligatorios");
    if (!POSITIONS.includes(dto.position as Position)) throw new BadRequestException("Posición inválida");
    const team = await this.prisma.team.findUnique({ where: { id: dto.teamId }, select: { id: true } });
    if (!team) throw new NotFoundException("Club no encontrado");
    const player = await this.prisma.player.create({
      data: { name: dto.name, position: dto.position as Position, teamId: dto.teamId, rating: Math.max(40, Math.min(99, Math.round(dto.rating ?? 70))) },
      select: { id: true, name: true, position: true, teamId: true, rating: true, value: true, team: { select: { name: true } } },
    });
    await this.audit(adminId, "player.create", player.id, player);
    await this.lifecycle.announceNewPlayer(player.id, player.name, player.team?.name ?? null); // noticia (ADR-018)
    return player;
  }

  /** Borra un jugador (sólo si no está en ninguna plantilla Fantasy). */
  async deletePlayer(adminId: string, playerId: string) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true, name: true, rosterOf: { select: { id: true }, take: 1 } } });
    if (!player) throw new NotFoundException("Jugador no encontrado");
    if (player.rosterOf.length > 0) throw new ConflictException("El jugador está fichado en alguna plantilla; reasígnalo antes de borrarlo");
    await this.prisma.player.delete({ where: { id: playerId } });
    await this.audit(adminId, "player.delete", playerId, { name: player.name });
    return { deleted: playerId };
  }

  /** Edita un entrenador: nombre y/o valor. */
  async updateCoach(adminId: string, coachId: string, dto: { name?: string; value?: number }) {
    const before = await this.prisma.coach.findUnique({ where: { id: coachId }, select: { name: true, value: true } });
    if (!before) throw new NotFoundException("Entrenador no encontrado");
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.value !== undefined) data.value = Math.max(0, Math.round(dto.value));
    if (Object.keys(data).length === 0) throw new BadRequestException("Nada que actualizar");
    const after = await this.prisma.coach.update({ where: { id: coachId }, data, select: { id: true, name: true, value: true } });
    await this.audit(adminId, "coach.update", coachId, { before, after });
    return after;
  }

  /** Reasigna un jugador de un equipo a otro dentro de una liga (deshacer/corregir fichaje). */
  async reassignPlayer(adminId: string, leagueId: string, dto: { playerId: string; toTeamId: string; price?: number; adjustMoney?: boolean }) {
    const teams = await this.prisma.fantasyTeam.findMany({ where: { membership: { leagueId } }, select: { id: true } });
    const teamIds = new Set(teams.map((t) => t.id));
    if (!teamIds.has(dto.toTeamId)) throw new BadRequestException("El equipo destino no pertenece a la liga");
    const current = await this.prisma.rosterPlayer.findFirst({
      where: { playerId: dto.playerId, fantasyTeamId: { in: [...teamIds] } },
      select: { id: true, fantasyTeamId: true, purchasePrice: true },
    });
    if (!current) throw new NotFoundException("El jugador no está fichado en esta liga");
    if (current.fantasyTeamId === dto.toTeamId) throw new ConflictException("El jugador ya pertenece a ese equipo");
    const price = Math.max(0, Math.round(dto.price ?? current.purchasePrice));

    const ops: unknown[] = [
      this.prisma.rosterPlayer.delete({ where: { id: current.id } }),
      this.prisma.rosterPlayer.create({ data: { fantasyTeamId: dto.toTeamId, playerId: dto.playerId, purchasePrice: price } }),
      // Quitar al jugador de cualquier alineación futura del equipo de origen para no dejar huecos.
      this.prisma.fantasyLineupSlot.deleteMany({
        where: { playerId: dto.playerId, lineup: { fantasyTeamId: current.fantasyTeamId, gameweek: { status: { not: "FINISHED" } } } },
      }),
    ];
    if (dto.adjustMoney) {
      // El destino paga `price` al origen (movimiento económico coherente y auditado).
      ops.push(
        this.prisma.fantasyTeam.update({ where: { id: dto.toTeamId }, data: { budget: { decrement: price } } }),
        this.prisma.transaction.create({ data: { fantasyTeamId: dto.toTeamId, type: "BUY", amount: -price, description: "Reasignación (admin)" } }),
        this.prisma.fantasyTeam.update({ where: { id: current.fantasyTeamId }, data: { budget: { increment: price } } }),
        this.prisma.transaction.create({ data: { fantasyTeamId: current.fantasyTeamId, type: "SELL", amount: price, description: "Reasignación (admin)" } }),
      );
    }
    await this.prisma.$transaction(ops as never);
    await this.audit(adminId, "roster.reassign", dto.playerId, { leagueId, from: current.fantasyTeamId, to: dto.toTeamId, price, adjustMoney: !!dto.adjustMoney });
    return { playerId: dto.playerId, from: current.fantasyTeamId, to: dto.toTeamId, price };
  }

  /** Fija manualmente los puntos de un equipo Fantasy en una jornada. */
  async setFantasyScore(adminId: string, dto: { fantasyTeamId: string; gameweekId: string; points: number }) {
    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId }, select: { id: true } });
    if (!team) throw new NotFoundException("Equipo no encontrado");
    const points = Math.round(dto.points);
    const before = await this.prisma.fantasyGameweekScore.findUnique({
      where: { fantasyTeamId_gameweekId: { fantasyTeamId: dto.fantasyTeamId, gameweekId: dto.gameweekId } },
      select: { points: true, eligible: true },
    });
    const row = await this.prisma.fantasyGameweekScore.upsert({
      where: { fantasyTeamId_gameweekId: { fantasyTeamId: dto.fantasyTeamId, gameweekId: dto.gameweekId } },
      create: { fantasyTeamId: dto.fantasyTeamId, gameweekId: dto.gameweekId, points, eligible: before?.eligible ?? true },
      update: { points },
      select: { points: true },
    });
    await this.audit(adminId, "fantasy.score", dto.fantasyTeamId, { gameweekId: dto.gameweekId, before: before?.points ?? null, after: row.points });
    return { fantasyTeamId: dto.fantasyTeamId, gameweekId: dto.gameweekId, points: row.points };
  }

  /** Recalcula una jornada ya jugada (tras corregir datos del Hub). */
  async recomputeGameweek(adminId: string, gameweekId: string) {
    const result = await this.scoring.computeGameweek(gameweekId);
    await this.audit(adminId, "gameweek.recompute", gameweekId, { playersScored: result.playersScored, teamsScored: result.teamsScored });
    return result;
  }

  // === Ciclo de vida del jugador (ADR-018) — el Hub reconcilia el vaivén real ===

  /** El jugador se va a otra liga: desaparece y cada dueño cobra su cláusula. */
  async transferOut(adminId: string, playerId: string) {
    const r = await this.lifecycle.transferOut(playerId);
    await this.audit(adminId, "player.transferOut", playerId, r);
    return r;
  }

  /** El jugador se retira: desaparece sin compensación. */
  async retirePlayer(adminId: string, playerId: string) {
    const r = await this.lifecycle.retire(playerId);
    await this.audit(adminId, "player.retire", playerId, r);
    return r;
  }

  /** Cambio de posición (medio → delantero, etc.). */
  async changePosition(adminId: string, playerId: string, position: string) {
    const r = await this.lifecycle.changePosition(playerId, position);
    await this.audit(adminId, "player.position", playerId, r);
    return r;
  }

  /** Cambio de club dentro del mismo campeonato. */
  async changeClub(adminId: string, playerId: string, teamId: string) {
    const r = await this.lifecycle.changeClub(playerId, teamId);
    await this.audit(adminId, "player.club", playerId, r);
    return r;
  }

  // === Gestión del Hub (ADR-019): inicializar y rellenar desde el proveedor ======

  /** Estado del Hub: proveedor activo, temporada y recuentos. */
  async hubStatus() {
    const [teams, players, coaches, gameweeks, played, season] = await Promise.all([
      this.prisma.team.count(),
      this.prisma.player.count(),
      this.prisma.coach.count(),
      this.prisma.gameweek.count(),
      this.prisma.gameweek.count({ where: { status: "FINISHED" } }),
      this.prisma.season.findFirst({ where: { current: true }, select: { name: true } }),
    ]);
    return {
      provider: (process.env.DATA_PROVIDER ?? "mock").trim(),
      season: season?.name ?? null,
      apiSeason: process.env.APIFOOTBALL_SEASON ?? null,
      teams, players, coaches, gameweeks, gameweeksPlayed: played,
      job: this.hubJob,
    };
  }

  /** INICIALIZAR: borra TODOS los datos (equipos, jugadores, ligas fantasy, partidos…) menos
   *  las CUENTAS de usuario. Deja el esquema intacto. Peligroso — solo admin. */
  async hubReset(adminId: string) {
    const rows = await this.prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'User')`;
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
    if (list) await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    await this.audit(adminId, "hub.reset", null, { tables: rows.length }); // se registra tras el borrado
    return { truncated: rows.length };
  }

  /** RELLENAR el Hub desde el proveedor activo. En segundo plano (con api-football tarda por el
   *  límite de 10 req/min); el admin ve el progreso en el estado del Hub. Idempotente. */
  hubBackfill(adminId: string) {
    return this.startJob("backfill", async () => {
      const provider = createProvider();
      const summary = await runBackfill(this.prisma, provider);
      await this.audit(adminId, "hub.backfill", null, { provider: provider.name, ...summary });
      return { provider: provider.name, ...summary };
    });
  }

  // === Solicitudes de reseteo de contraseña (aprobación del admin) ==============

  /** Solicitudes de reseteo pendientes. */
  async listResetRequests() {
    const rows = await this.prisma.passwordResetRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, user: { select: { email: true, displayName: true } } },
    });
    return rows.map((r) => ({ id: r.id, userEmail: r.user.email, userName: r.user.displayName, createdAt: r.createdAt }));
  }

  /** Aprueba: la contraseña del usuario pasa a "12345678" (la cambia al entrar). */
  async approveResetRequest(adminId: string, id: string) {
    const req = await this.prisma.passwordResetRequest.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (!req || req.status !== "PENDING") throw new NotFoundException("Solicitud no encontrada o ya resuelta");
    const passwordHash = bcrypt.hashSync("12345678", 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: req.userId }, data: { passwordHash } }),
      this.prisma.passwordResetRequest.update({ where: { id }, data: { status: "APPROVED", resolvedAt: new Date() } }),
    ]);
    await this.audit(adminId, "reset.approve", req.userId, {});
    return { ok: true, tempPassword: "12345678" };
  }

  /** Rechaza la solicitud sin cambiar nada. */
  async rejectResetRequest(adminId: string, id: string) {
    const req = await this.prisma.passwordResetRequest.findUnique({ where: { id }, select: { status: true } });
    if (!req || req.status !== "PENDING") throw new NotFoundException("Solicitud no encontrada o ya resuelta");
    await this.prisma.passwordResetRequest.update({ where: { id }, data: { status: "REJECTED", resolvedAt: new Date() } });
    await this.audit(adminId, "reset.reject", id, {});
    return { ok: true };
  }

  /** Comprueba cambios en el proveedor (altas, club, posición, bajas). En segundo plano. */
  hubSyncChanges(adminId: string) {
    return this.startJob("sync-changes", async () => {
      const r = await this.hubSync.detectChanges();
      await this.audit(adminId, "hub.syncChanges", null, r);
      return r;
    });
  }

  /** Juega (ingiere + puntúa) las próximas `count` jornadas. En segundo plano. */
  hubPlay(adminId: string, count: number) {
    const n = Math.max(1, Math.min(5, Math.round(count || 1)));
    return this.startJob("play", async () => {
      const provider = createProvider();
      const pending = await this.prisma.gameweek.findMany({ where: { status: { not: "FINISHED" } }, orderBy: { number: "asc" }, take: n });
      let scoredTotal = 0;
      for (const gw of pending) {
        await playGameweekRecord(this.prisma, provider, gw);
        const scored = await this.scoring.computeGameweek(gw.id);
        scoredTotal += scored.playersScored;
      }
      await this.audit(adminId, "hub.play", null, { count: pending.length });
      return { playedGameweeks: pending.length, playersScored: scoredTotal };
    });
  }
}
