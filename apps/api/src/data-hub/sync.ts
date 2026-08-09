// SyncService (backfill) — consume un FootballDataProvider y vuelca los datos maestros a
// NUESTRA base de datos con IDs internos, mapeando IDs externos vía ProviderMapping (ADR-006).
// Idempotente: re-ejecutar no duplica (el mapeo resuelve lo ya existente).

import type { PrismaClient } from "../generated/prisma/client";
import { FootballDataProvider } from "./provider.port";

/** Minutos antes del primer partido en que se cierra la alineación de la jornada (ADR-010). */
export const LINEUP_LOCK_MINUTES = 30;

export interface BackfillSummary {
  teams: number;
  players: number;
  coaches: number;
  gameweeks: number;
  matches: number;
}

export async function backfill(
  prisma: PrismaClient,
  provider: FootballDataProvider,
): Promise<BackfillSummary> {
  const providerName = provider.name;

  /** Resuelve el ID interno vía ProviderMapping; si no existe, crea la entidad y guarda el mapeo. */
  async function mapOrCreate(
    entityType: string,
    externalId: string,
    createFn: () => Promise<{ id: string }>,
  ): Promise<string> {
    const found = await prisma.providerMapping.findUnique({
      where: { provider_entityType_externalId: { provider: providerName, entityType, externalId } },
    });
    if (found) return found.internalId;
    const created = await createFn();
    await prisma.providerMapping.create({
      data: { provider: providerName, entityType, externalId, internalId: created.id },
    });
    return created.id;
  }

  // --- Competición y temporada ---
  const comp = await provider.getCompetition();
  const competitionId = await mapOrCreate("competition", comp.externalId, () =>
    prisma.competition.create({ data: { name: comp.name, country: comp.country } }),
  );
  const seasonId = await mapOrCreate("season", `${comp.externalId}-${comp.season}`, () =>
    prisma.season.create({ data: { competitionId, name: comp.season, current: true } }),
  );

  // --- Equipos ---
  const teams = await provider.getTeams();
  const teamId = new Map<string, string>(); // externalId -> internalId
  for (const t of teams) {
    const id = await mapOrCreate("team", t.externalId, () =>
      prisma.team.create({ data: { name: t.name, shortName: t.shortName, crestUrl: t.crestUrl ?? null } }),
    );
    // Refresca el escudo también en equipos ya existentes (p. ej. si antes no se capturó).
    if (t.crestUrl) await prisma.team.update({ where: { id }, data: { crestUrl: t.crestUrl } });
    teamId.set(t.externalId, id);
  }

  // --- Plantillas ---
  // REANUDABLE: si un equipo ya tiene plantilla en la BD, NO pedimos su squad al proveedor. Así,
  // si un backfill se corta a mitad (p. ej. límite diario de peticiones), reejecutar "Rellenar"
  // (SIN reinicializar) continúa por los equipos que faltan en vez de gastar cuota repitiendo.
  let players = 0;
  for (const t of teams) {
    const internalTeamId = teamId.get(t.externalId)!;
    const existing = await prisma.player.count({ where: { teamId: internalTeamId } });
    if (existing > 0) {
      players += existing;
      continue;
    }
    const squad = await provider.getSquad(t.externalId);
    for (const p of squad) {
      await mapOrCreate("player", p.externalId, () =>
        prisma.player.create({
          data: { name: p.name, position: p.position, rating: p.rating, teamId: teamId.get(p.teamExternalId)! },
        }),
      );
      players++;
    }
  }

  // --- Entrenadores ---
  // REANUDABLE: pedimos entrenador SÓLO a los equipos que aún no lo tienen.
  const teamsMissingCoach: string[] = [];
  for (const t of teams) {
    const has = await prisma.coach.count({ where: { teamId: teamId.get(t.externalId)! } });
    if (has === 0) teamsMissingCoach.push(t.externalId);
  }
  const coaches = teamsMissingCoach.length ? await provider.getCoaches(teamsMissingCoach) : [];
  for (const c of coaches) {
    await mapOrCreate("coach", c.externalId, () =>
      prisma.coach.create({ data: { name: c.name, teamId: teamId.get(c.teamExternalId)! } }),
    );
  }
  const coachTotal = await prisma.coach.count({ where: { teamId: { in: [...teamId.values()] } } });

  // --- Calendario: jornadas + partidos ---
  // Anclado a HOY: la 1ª jornada arranca en +ANCHOR_DAYS y cada jornada va +1 semana, de modo
  // que las jornadas no jugadas quedan en el FUTURO (deadlines válidos). La fecha límite de
  // alineación es 30 min antes del primer partido de la jornada (ADR-010).
  //
  // IMPORTANTE (ADR-010/019/020): NO imponemos un calendario ficticio. Para la temporada de
  // PRUEBA (2023, ya jugada) esto reparte cada jornada a UN solo día (todos los partidos a la
  // misma hora) — simple y suficiente. En PRODUCCIÓN, con la temporada EN CURSO, el calendario
  // real (desfases Vie-Lun, jornadas entre semana, aplazamientos) debe venir del proveedor y
  // refrescarse a diario (ver ADR-020 · "Fuente del calendario"). El motor ya liquida por el
  // PRIMER y el ÚLTIMO partido reales de la jornada, así que soporta cualquier reparto sin cambios.
  const fixtures = await provider.getFixtures();
  const ANCHOR_DAYS = 3;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const LOCK_MS = LINEUP_LOCK_MINUTES * 60 * 1000;
  const anchor = new Date(Date.now() + ANCHOR_DAYS * 24 * 60 * 60 * 1000);
  anchor.setUTCHours(18, 0, 0, 0);
  const kickoffOf = (matchday: number) => new Date(anchor.getTime() + (matchday - 1) * WEEK_MS);

  const matchdays = [...new Set(fixtures.map((f) => f.matchday))].sort((a, b) => a - b);
  const gameweekId = new Map<number, string>();
  for (const matchday of matchdays) {
    const kickoff = kickoffOf(matchday);
    const id = await mapOrCreate("gameweek", `${comp.externalId}-${comp.season}-gw${matchday}`, () =>
      prisma.gameweek.create({
        data: { seasonId, number: matchday, deadline: new Date(kickoff.getTime() - LOCK_MS) },
      }),
    );
    gameweekId.set(matchday, id);
  }

  let matches = 0;
  for (const f of fixtures) {
    await mapOrCreate("match", f.externalId, () =>
      prisma.match.create({
        data: {
          seasonId,
          gameweekId: gameweekId.get(f.matchday)!,
          homeTeamId: teamId.get(f.homeTeamExternalId)!,
          awayTeamId: teamId.get(f.awayTeamExternalId)!,
          kickoff: kickoffOf(f.matchday),
          status: "SCHEDULED",
        },
      }),
    );
    matches++;
  }

  return { teams: teams.length, players, coaches: coachTotal, gameweeks: gameweekId.size, matches };
}

export interface GameweekResult {
  matchday: number;
  matches: number;
  events: number;
}

/** Simula e ingiere una jornada por su NÚMERO (busca la 1ª con ese número). */
export async function playGameweek(
  prisma: PrismaClient,
  provider: FootballDataProvider,
  matchday: number,
): Promise<GameweekResult> {
  const gw = await prisma.gameweek.findFirst({ where: { number: matchday } });
  if (!gw) throw new Error(`Jornada ${matchday} no existe`);
  return playGameweekRecord(prisma, provider, gw);
}

/** Simula e ingiere una jornada concreta (por su registro): resultado + eventos + alineaciones. Idempotente. */
export async function playGameweekRecord(
  prisma: PrismaClient,
  provider: FootballDataProvider,
  gw: { id: string; number: number },
): Promise<GameweekResult> {
  const matches = await prisma.match.findMany({ where: { gameweekId: gw.id } });

  // Mapas externalId <-> internalId (una query por tipo)
  const playerMaps = await prisma.providerMapping.findMany({
    where: { provider: provider.name, entityType: "player" },
  });
  const extToPlayer = new Map(playerMaps.map((m) => [m.externalId, m.internalId]));

  const matchMaps = await prisma.providerMapping.findMany({
    where: { provider: provider.name, entityType: "match", internalId: { in: matches.map((m) => m.id) } },
  });
  const intToExtMatch = new Map(matchMaps.map((m) => [m.internalId, m.externalId]));

  let totalEvents = 0;
  for (const match of matches) {
    const ext = intToExtMatch.get(match.id);
    if (!ext) continue;
    const data = await provider.getMatchData(ext);

    // Idempotencia: limpiar lo previo de este partido y reinsertar
    await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });
    await prisma.appearance.deleteMany({ where: { matchId: match.id } });

    const appData = data.appearances
      .map((a) => ({ playerId: extToPlayer.get(a.playerExternalId), started: a.started, minutes: a.minutes, stats: (a.stats ?? {}) as Record<string, number> }))
      .filter((a) => a.playerId)
      .map((a) => ({ matchId: match.id, playerId: a.playerId as string, started: a.started, minutes: a.minutes, stats: a.stats }));
    if (appData.length) await prisma.appearance.createMany({ data: appData });

    const evData = data.events.map((e) => ({
      matchId: match.id,
      playerId: e.playerExternalId ? extToPlayer.get(e.playerExternalId) ?? null : null,
      minute: e.minute,
      type: e.type,
    }));
    if (evData.length) await prisma.matchEvent.createMany({ data: evData });

    await prisma.match.update({
      where: { id: match.id },
      data: { homeGoals: data.homeGoals, awayGoals: data.awayGoals, status: "FINISHED" },
    });
    totalEvents += data.events.length;
  }

  await prisma.gameweek.update({ where: { id: gw.id }, data: { status: "FINISHED" } });
  return { matchday: gw.number, matches: matches.length, events: totalEvents };
}

/** Fast-forward: juega las próximas `count` jornadas no finalizadas, en orden. */
export async function playThrough(
  prisma: PrismaClient,
  provider: FootballDataProvider,
  count: number,
): Promise<GameweekResult[]> {
  const pending = await prisma.gameweek.findMany({
    where: { status: { not: "FINISHED" } },
    orderBy: { number: "asc" },
    take: count,
  });
  const results: GameweekResult[] = [];
  for (const gw of pending) {
    results.push(await playGameweekRecord(prisma, provider, gw));
  }
  return results;
}
