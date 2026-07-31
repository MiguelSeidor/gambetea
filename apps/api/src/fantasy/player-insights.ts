// Utilidades compartidas para enriquecer jugadores en la UI (plantilla, alineación, mercado):
// puntos de temporada y estado lesionado/sancionado. Sin dependencia de módulo (reciben Prisma).
//
// Estado: hoy el mock no persiste lesiones/sanciones como registros, así que lo DERIVAMOS de los
// eventos de la última jornada jugada (INJURY → lesionado; RED → sancionado para la siguiente).
// Cuando conectemos el proveedor real, se rellenará con sus datos oficiales sin tocar la UI.

import { PrismaService } from "../prisma/prisma.service";

export interface PlayerStatus {
  injured: boolean;
  suspended: boolean;
}

/** Puntos de temporada (baremo por defecto) por jugador, para una temporada. */
export async function seasonPointsMap(prisma: PrismaService, seasonId: string): Promise<Map<string, number>> {
  const grouped = await prisma.playerGameweekScore.groupBy({
    by: ["playerId"],
    where: { gameweek: { seasonId } },
    _sum: { points: true },
  });
  return new Map(grouped.map((g) => [g.playerId, g._sum.points ?? 0]));
}

/** Puntos de temporada por entrenador, para una temporada. */
export async function coachSeasonPointsMap(prisma: PrismaService, seasonId: string): Promise<Map<string, number>> {
  const grouped = await prisma.coachGameweekScore.groupBy({
    by: ["coachId"],
    where: { gameweek: { seasonId } },
    _sum: { points: true },
  });
  return new Map(grouped.map((g) => [g.coachId, g._sum.points ?? 0]));
}

/** Estado lesionado/sancionado por jugador, derivado de la última jornada FINISHED. */
export async function statusMap(prisma: PrismaService, seasonId: string): Promise<Map<string, PlayerStatus>> {
  const lastGw = await prisma.gameweek.findFirst({
    where: { seasonId, status: "FINISHED" },
    orderBy: { number: "desc" },
    select: { id: true },
  });
  const map = new Map<string, PlayerStatus>();
  if (!lastGw) return map;
  const events = await prisma.matchEvent.findMany({
    where: { match: { gameweekId: lastGw.id }, type: { in: ["INJURY", "RED"] }, playerId: { not: null } },
    select: { playerId: true, type: true },
  });
  for (const e of events) {
    if (!e.playerId) continue;
    const s = map.get(e.playerId) ?? { injured: false, suspended: false };
    if (e.type === "INJURY") s.injured = true;
    if (e.type === "RED") s.suspended = true;
    map.set(e.playerId, s);
  }
  return map;
}
