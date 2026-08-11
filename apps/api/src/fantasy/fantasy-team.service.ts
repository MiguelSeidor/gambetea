import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { INITIAL_BUDGET } from "../market/economy.rules";
import { ValuationService } from "../market/valuation.service";
import { SaveLineupDto } from "./dto/save-lineup.dto";
import { DEFAULT_FORMATION, formationCounts, Position, SQUAD_COMPOSITION } from "./fantasy.rules";
import { coachSeasonPointsMap, seasonPointsMap, statusMap } from "./player-insights";

@Injectable()
export class FantasyTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuation: ValuationService,
  ) {}

  // --- Resolución de "mi equipo en la liga X" ---------------------------------

  private async resolveTeam(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { fantasyTeam: true, league: { select: { seasonId: true } } },
    });
    if (!membership) throw new ForbiddenException("No perteneces a esta liga");
    if (!membership.fantasyTeam) throw new NotFoundException("Equipo Fantasy no inicializado");
    return { team: membership.fantasyTeam, seasonId: membership.league.seasonId };
  }

  // --- Draft inicial (bootstrap provisional — ver docs/07_FANTASY_RULES.md) ----

  /** Auto-asigna una plantilla válida al equipo, descontando el valor del presupuesto.
   *  Idempotente (no hace nada si ya tiene plantilla). */
  async initialize(fantasyTeamId: string, seasonId: string): Promise<void> {
    const already = await this.prisma.rosterPlayer.count({ where: { fantasyTeamId } });
    if (already > 0) return;

    await this.valuation.ensureValues(seasonId);

    const matches = await this.prisma.match.findMany({
      where: { seasonId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];

    const players = await this.prisma.player.findMany({
      where: { teamId: { in: teamIds }, status: "ACTIVE" },
      select: { id: true, position: true, value: true },
    });

    const byPos: Record<Position, { id: string; value: number }[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of players) byPos[p.position as Position].push({ id: p.id, value: p.value });

    const picked: { id: string; value: number }[] = [];
    for (const pos of Object.keys(SQUAD_COMPOSITION) as Position[]) {
      const pool = shuffle(byPos[pos]);
      const need = SQUAD_COMPOSITION[pos];
      if (pool.length < need) {
        throw new BadRequestException(`No hay suficientes jugadores (${pos}) para el draft`);
      }
      picked.push(...pool.slice(0, need));
    }

    // Un entrenador inicial (aleatorio) de la competición.
    const coaches = await this.prisma.coach.findMany({
      where: { teamId: { in: teamIds } },
      select: { id: true, value: true },
    });
    const coach = shuffle(coaches)[0];

    // Config económica de la liga (presupuesto inicial + Derechos de TV) — ADR-014.
    const membership = await this.prisma.leagueMembership.findFirst({
      where: { fantasyTeam: { id: fantasyTeamId } },
      include: { league: { select: { settings: true } } },
    });
    const settings = membership?.league.settings;
    const initBudget = settings?.initialBudget ?? INITIAL_BUDGET;
    const tvRights = settings?.tvRights ?? 0;

    const cost = picked.reduce((s, p) => s + p.value, 0) + (coach?.value ?? 0);
    const budget = Math.max(0, initBudget - cost) + tvRights;

    await this.prisma.$transaction([
      this.prisma.rosterPlayer.createMany({
        data: picked.map((p) => ({ fantasyTeamId, playerId: p.id, purchasePrice: p.value })),
      }),
      ...(coach
        ? [this.prisma.rosterCoach.create({ data: { fantasyTeamId, coachId: coach.id, purchasePrice: coach.value } })]
        : []),
      this.prisma.stadium.create({ data: { fantasyTeamId, level: 0 } }),
      ...(tvRights > 0
        ? [this.prisma.transaction.create({ data: { fantasyTeamId, type: "ADJUST", amount: tvRights, description: "Derechos de TV" } })]
        : []),
      this.prisma.fantasyTeam.update({ where: { id: fantasyTeamId }, data: { budget } }),
    ]);
  }

  // --- Lectura de plantilla ----------------------------------------------------

  async getTeam(userId: string, leagueId: string) {
    const { team, seasonId } = await this.resolveTeam(userId, leagueId);
    const [points, status, coachPoints] = await Promise.all([
      seasonPointsMap(this.prisma, seasonId),
      statusMap(this.prisma, seasonId),
      coachSeasonPointsMap(this.prisma, seasonId),
    ]);
    const roster = await this.prisma.rosterPlayer.findMany({
      where: { fantasyTeamId: team.id },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            value: true,
            valueDelta: true,
            team: { select: { id: true, name: true, shortName: true } },
          },
        },
      },
    });
    const players = roster.map((r) => ({
      id: r.player.id,
      name: r.player.name,
      position: r.player.position,
      teamId: r.player.team?.id ?? null,
      club: r.player.team?.shortName ?? null,
      clubName: r.player.team?.name ?? null,
      value: r.player.value,
      valueDelta: r.player.valueDelta,
      purchasePrice: r.purchasePrice,
      points: points.get(r.player.id) ?? 0,
      injured: status.get(r.player.id)?.injured ?? false,
      suspended: status.get(r.player.id)?.suspended ?? false,
    }));
    const rosterCoaches = await this.prisma.rosterCoach.findMany({
      where: { fantasyTeamId: team.id },
      include: { coach: { select: { id: true, name: true, value: true, team: { select: { id: true, name: true, shortName: true } } } } },
    });
    const coaches = rosterCoaches.map((r) => ({
      id: r.coach.id,
      name: r.coach.name,
      teamId: r.coach.team?.id ?? null,
      club: r.coach.team?.shortName ?? null,
      clubName: r.coach.team?.name ?? null,
      value: r.coach.value,
      purchasePrice: r.purchasePrice,
      points: coachPoints.get(r.coach.id) ?? 0,
    }));
    const squadValue = players.reduce((s, p) => s + p.value, 0) + coaches.reduce((s, c) => s + c.value, 0);
    return {
      id: team.id,
      name: team.name,
      budget: team.budget,
      squadValue,
      totalWorth: team.budget + squadValue,
      squadSize: players.length,
      players,
      coaches,
    };
  }

  // --- Alineación --------------------------------------------------------------

  async getLineup(userId: string, leagueId: string, gameweekId?: string) {
    const { team, seasonId } = await this.resolveTeam(userId, leagueId);
    const gw = await this.resolveGameweek(seasonId, gameweekId, false);

    const lineup = await this.prisma.fantasyLineup.findUnique({
      where: { fantasyTeamId_gameweekId: { fantasyTeamId: team.id, gameweekId: gw.id } },
      include: { slots: { orderBy: { order: "asc" } } },
    });

    const gameweek = { id: gw.id, number: gw.number, status: gw.status, deadline: gw.deadline };
    if (!lineup) {
      // Sin alineación para esta jornada: si es una jornada POR JUGAR, arrastramos la ÚLTIMA
      // alineación guardada (la persistimos), filtrada a la plantilla actual — los jugadores que
      // ya no tienes dejan HUECO. Así la alineación se mantiene entre jornadas en vez de vaciarse.
      const seeded = gw.status !== "FINISHED" ? await this.seedLineupFromPrevious(team.id, gw.id) : null;
      if (!seeded) {
        return { gameweek, formation: DEFAULT_FORMATION, captainId: null, coachId: null, starters: [], bench: [] };
      }
      const info = await this.playerInfo(seeded.slots.map((s) => s.playerId), seasonId);
      return {
        gameweek,
        formation: seeded.formation,
        captainId: seeded.captainId,
        coachId: seeded.coachId,
        starters: seeded.slots.filter((s) => s.role === "STARTER").map((s) => info[s.playerId]),
        bench: seeded.slots.filter((s) => s.role === "BENCH").map((s) => info[s.playerId]),
      };
    }
    const playerIds = lineup.slots.map((s) => s.playerId);
    const info = await this.playerInfo(playerIds, seasonId);
    return {
      gameweek,
      formation: lineup.formation,
      captainId: lineup.captainId,
      coachId: lineup.coachId,
      starters: lineup.slots.filter((s) => s.role === "STARTER").map((s) => info[s.playerId]),
      bench: lineup.slots.filter((s) => s.role === "BENCH").map((s) => info[s.playerId]),
    };
  }

  async saveLineup(userId: string, leagueId: string, dto: SaveLineupDto) {
    const { team, seasonId } = await this.resolveTeam(userId, leagueId);
    const gw = await this.resolveGameweek(seasonId, dto.gameweekId, true);

    // Posiciones de la plantilla del equipo
    const roster = await this.prisma.rosterPlayer.findMany({
      where: { fantasyTeamId: team.id },
      include: { player: { select: { id: true, position: true } } },
    });
    const posOf = new Map(roster.map((r) => [r.player.id, r.player.position as Position]));

    this.validateLineup(dto, posOf);

    // El entrenador elegido debe ser uno de los del roster.
    if (dto.coachId) {
      const owns = await this.prisma.rosterCoach.count({
        where: { fantasyTeamId: team.id, coachId: dto.coachId },
      });
      if (owns === 0) throw new BadRequestException("Ese entrenador no está en tu plantilla");
    }

    await this.prisma.$transaction(async (tx) => {
      const lineup = await tx.fantasyLineup.upsert({
        where: { fantasyTeamId_gameweekId: { fantasyTeamId: team.id, gameweekId: gw.id } },
        create: {
          fantasyTeamId: team.id,
          gameweekId: gw.id,
          formation: dto.formation,
          captainId: dto.captainId ?? null,
          coachId: dto.coachId ?? null,
        },
        update: { formation: dto.formation, captainId: dto.captainId ?? null, coachId: dto.coachId ?? null },
      });
      await tx.fantasyLineupSlot.deleteMany({ where: { lineupId: lineup.id } });
      await tx.fantasyLineupSlot.createMany({
        data: [
          ...dto.starters.map((playerId, i) => ({
            lineupId: lineup.id,
            playerId,
            role: "STARTER" as const,
            order: i + 1,
          })),
          ...dto.bench.map((playerId, i) => ({
            lineupId: lineup.id,
            playerId,
            role: "BENCH" as const,
            order: i + 1,
          })),
        ],
      });
    });

    return this.getLineup(userId, leagueId, gw.id);
  }

  // --- Helpers -----------------------------------------------------------------

  /** Copia la última alineación guardada del equipo a `targetGwId` (persistida), filtrando a la
   *  plantilla actual: los jugadores que ya no tienes dejan hueco. Devuelve la creada, o null. */
  private async seedLineupFromPrevious(teamId: string, targetGwId: string) {
    const prev = await this.prisma.fantasyLineup.findFirst({
      where: { fantasyTeamId: teamId, gameweekId: { not: targetGwId }, slots: { some: {} } },
      orderBy: { gameweek: { number: "desc" } },
      include: { slots: { orderBy: { order: "asc" } } },
    });
    if (!prev) return null;
    const roster = await this.prisma.rosterPlayer.findMany({ where: { fantasyTeamId: teamId }, select: { playerId: true } });
    const owned = new Set(roster.map((r) => r.playerId));
    const starters = prev.slots.filter((s) => s.role === "STARTER" && owned.has(s.playerId)).map((s) => s.playerId);
    const bench = prev.slots.filter((s) => s.role === "BENCH" && owned.has(s.playerId)).map((s) => s.playerId);
    const coachOwned = prev.coachId
      ? (await this.prisma.rosterCoach.count({ where: { fantasyTeamId: teamId, coachId: prev.coachId } })) > 0
      : false;
    try {
      return await this.prisma.fantasyLineup.create({
        data: {
          fantasyTeamId: teamId,
          gameweekId: targetGwId,
          formation: prev.formation,
          captainId: prev.captainId && owned.has(prev.captainId) ? prev.captainId : null,
          coachId: coachOwned ? prev.coachId : null,
          slots: {
            create: [
              ...starters.map((playerId, i) => ({ playerId, role: "STARTER" as const, order: i + 1 })),
              ...bench.map((playerId, i) => ({ playerId, role: "BENCH" as const, order: i + 1 })),
            ],
          },
        },
        include: { slots: { orderBy: { order: "asc" } } },
      });
    } catch {
      // Carrera: otra petición ya la creó → devolvemos la existente.
      return this.prisma.fantasyLineup.findUnique({
        where: { fantasyTeamId_gameweekId: { fantasyTeamId: teamId, gameweekId: targetGwId } },
        include: { slots: { orderBy: { order: "asc" } } },
      });
    }
  }

  private validateLineup(dto: SaveLineupDto, posOf: Map<string, Position>) {
    const all = [...dto.starters, ...dto.bench];
    const unique = new Set(all);
    if (unique.size !== all.length) {
      throw new BadRequestException("Hay jugadores repetidos entre titulares y suplentes");
    }
    // Los seleccionados deben ser de la plantilla (sin límite de tamaño: el resto queda fuera).
    for (const id of all) {
      if (!posOf.has(id)) {
        throw new BadRequestException("Un jugador seleccionado no pertenece a tu plantilla");
      }
    }
    // Recuento por posición: los titulares NO pueden EXCEDER la formación, pero SÍ pueden faltar
    // (hueco). Una plaza vacía penaliza (no puntúa) pero se permite guardar la alineación así
    // —el usuario decide—; la advertencia se muestra en el frontend.
    const required = formationCounts(dto.formation);
    const actual: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const id of dto.starters) actual[posOf.get(id)!]++;
    if (dto.starters.length > 11) {
      throw new BadRequestException("No puedes alinear más de 11 titulares");
    }
    for (const pos of Object.keys(required) as Position[]) {
      if (actual[pos] > required[pos]) {
        throw new BadRequestException(
          `Demasiados ${pos} para la formación ${dto.formation}: ${actual[pos]}/${required[pos]}`,
        );
      }
    }
    if (dto.captainId && !dto.starters.includes(dto.captainId)) {
      throw new BadRequestException("El capitán debe ser un titular");
    }
  }

  private async resolveGameweek(seasonId: string, gameweekId: string | undefined, forEdit: boolean) {
    if (gameweekId) {
      const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId } });
      if (!gw || gw.seasonId !== seasonId) {
        throw new NotFoundException("Jornada no encontrada en esta liga");
      }
      // La alineación se puede editar mientras la jornada no haya finalizado. Lo que puntúa
      // es el SNAPSHOT tomado 30 min antes del primer partido (ADR-010); editar después no
      // cambia esa jornada.
      if (forEdit && gw.status === "FINISHED") {
        throw new BadRequestException("La jornada ya se ha jugado; no admite cambios");
      }
      return gw;
    }
    // Próxima jornada por jugar (la más cercana no finalizada).
    const gw = await this.prisma.gameweek.findFirst({
      where: { seasonId, status: { in: ["UPCOMING", "OPEN"] } },
      orderBy: { number: "asc" },
    });
    if (!gw) throw new BadRequestException("No hay jornada por jugar para alinear");
    return gw;
  }

  private async playerInfo(ids: string[], seasonId: string) {
    const [players, points, status] = await Promise.all([
      this.prisma.player.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, position: true, team: { select: { id: true, name: true, shortName: true } } },
      }),
      seasonPointsMap(this.prisma, seasonId),
      statusMap(this.prisma, seasonId),
    ]);
    return Object.fromEntries(
      players.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          position: p.position,
          teamId: p.team?.id ?? null,
          club: p.team?.shortName ?? null,
          clubName: p.team?.name ?? null,
          points: points.get(p.id) ?? 0,
          injured: status.get(p.id)?.injured ?? false,
          suspended: status.get(p.id)?.suspended ?? false,
        },
      ]),
    );
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
