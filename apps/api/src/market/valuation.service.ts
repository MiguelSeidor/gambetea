import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  cappedValue,
  coachValueFromStrength,
  PRESSURE_CAP,
  PRESSURE_LISTED,
  PRESSURE_PER_BID,
  RECENCY_EXTRA_FACTOR,
  ratingBaseValue,
  targetPlayerValue,
} from "./economy.rules";

@Injectable()
export class ValuationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula el valor de mercado de la temporada (ADR-022): calidad + rendimiento (con RECENCIA:
   * la última jornada pesa más) + OFERTA/DEMANDA (pujas/venta), con TOPE de ±8 %/día y guardando la
   * variación (`valueDelta`) para mostrar el ↑/↓. Se ejecuta a diario (00:00). Idempotente.
   */
  async refreshValues(seasonId: string): Promise<number> {
    // Equipos de la temporada (vía partidos) y sus jugadores (con el valor actual, para el tope).
    const matches = await this.prisma.match.findMany({
      where: { seasonId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const players = await this.prisma.player.findMany({
      where: { teamId: { in: teamIds } },
      select: { id: true, rating: true, teamId: true, value: true },
    });
    // Rating medio por equipo (fuerza de plantilla) → valor base del entrenador.
    const teamRatings = new Map<string, number[]>();
    for (const p of players) {
      if (!p.teamId) continue;
      (teamRatings.get(p.teamId) ?? teamRatings.set(p.teamId, []).get(p.teamId)!).push(p.rating);
    }
    const teamAvgRating = new Map<string, number>();
    for (const [tid, rs] of teamRatings) teamAvgRating.set(tid, rs.reduce((a, b) => a + b, 0) / rs.length);

    // Puntos de temporada por jugador (suma de PlayerGameweekScore de la temporada).
    const grouped = await this.prisma.playerGameweekScore.groupBy({
      by: ["playerId"],
      where: { gameweek: { seasonId } },
      _sum: { points: true },
    });
    const pointsOf = new Map(grouped.map((g) => [g.playerId, g._sum.points ?? 0]));

    // RECENCIA: puntos de la ÚLTIMA jornada finalizada (pesan extra).
    const lastGw = await this.prisma.gameweek.findFirst({
      where: { seasonId, status: "FINISHED" },
      orderBy: { number: "desc" },
      select: { id: true },
    });
    const lastPlayerPts = new Map<string, number>();
    const lastCoachPts = new Map<string, number>();
    if (lastGw) {
      const [pScores, cScores] = await Promise.all([
        this.prisma.playerGameweekScore.findMany({ where: { gameweekId: lastGw.id }, select: { playerId: true, points: true } }),
        this.prisma.coachGameweekScore.findMany({ where: { gameweekId: lastGw.id }, select: { coachId: true, points: true } }),
      ]);
      for (const s of pScores) lastPlayerPts.set(s.playerId, s.points);
      for (const s of cScores) lastCoachPts.set(s.coachId, s.points);
    }

    // OFERTA/DEMANDA (v1): pujas recibidas en los últimos 7 días (demanda) y estar en venta (oferta).
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentBids, listed] = await Promise.all([
      this.prisma.bid.findMany({ where: { createdAt: { gte: weekAgo }, listing: { playerId: { not: null } } }, select: { listing: { select: { playerId: true } } } }),
      this.prisma.marketListing.findMany({ where: { status: "OPEN", sellerTeamId: { not: null }, playerId: { not: null } }, select: { playerId: true } }),
    ]);
    const bidCount = new Map<string, number>();
    for (const b of recentBids) { const id = b.listing.playerId; if (id) bidCount.set(id, (bidCount.get(id) ?? 0) + 1); }
    const isListed = new Set(listed.map((l) => l.playerId!));
    const pressureOf = (p: { id: string; rating: number }) => {
      const pct = Math.max(-PRESSURE_CAP, Math.min(PRESSURE_CAP, (bidCount.get(p.id) ?? 0) * PRESSURE_PER_BID - (isListed.has(p.id) ? PRESSURE_LISTED : 0)));
      return ratingBaseValue(p.rating) * pct;
    };

    // Objetivo → tope diario → valor y variación.
    const playerRows: [string, number, number][] = players.map((p) => {
      const target = targetPlayerValue(p.rating, pointsOf.get(p.id) ?? 0, lastPlayerPts.get(p.id) ?? 0, pressureOf(p));
      const next = cappedValue(p.value, target);
      return [p.id, next, next - p.value];
    });
    await this.bulkUpdateValues("Player", playerRows);

    // Entrenadores: base por FUERZA del equipo + rendimiento (con recencia); mismo tope y variación.
    const coaches = await this.prisma.coach.findMany({ where: { teamId: { in: teamIds } }, select: { id: true, teamId: true, value: true } });
    const coachGrouped = await this.prisma.coachGameweekScore.groupBy({
      by: ["coachId"],
      where: { gameweek: { seasonId } },
      _sum: { points: true },
    });
    const coachPointsOf = new Map(coachGrouped.map((g) => [g.coachId, g._sum.points ?? 0]));
    const coachRows: [string, number, number][] = coaches.map((c) => {
      const base = coachValueFromStrength(c.teamId ? (teamAvgRating.get(c.teamId) ?? 70) : 70, coachPointsOf.get(c.id) ?? 0);
      const target = Math.max(0, base + (lastCoachPts.get(c.id) ?? 0) * RECENCY_EXTRA_FACTOR);
      const next = cappedValue(c.value, target);
      return [c.id, next, next - c.value];
    });
    await this.bulkUpdateValues("Coach", coachRows);
    return players.length;
  }

  /** UPDATE en bloque de `value` + `valueDelta` para muchas filas (ids cuid + enteros, seguro). */
  private async bulkUpdateValues(table: "Player" | "Coach", rows: [string, number, number][]): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map(([id, v, d]) => `('${id}',${Math.round(v)},${Math.round(d)})`).join(",");
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${table}" AS t SET value = v.val, "valueDelta" = v.delta FROM (VALUES ${values}) AS v(id, val, delta) WHERE t.id = v.id`,
    );
  }

  /** Inicializa los valores base si aún no se han calculado para la temporada. */
  async ensureValues(seasonId: string): Promise<void> {
    const matches = await this.prisma.match.findMany({
      where: { seasonId },
      select: { homeTeamId: true, awayTeamId: true },
      take: 1,
    });
    if (matches.length === 0) return;
    const teamPair = [matches[0].homeTeamId, matches[0].awayTeamId];
    const [playersValued, coachesValued] = await Promise.all([
      this.prisma.player.count({ where: { teamId: { in: teamPair }, value: { gt: 0 } } }),
      this.prisma.coach.count({ where: { teamId: { in: teamPair }, value: { gt: 0 } } }),
    ]);
    if (playersValued === 0 || coachesValued === 0) await this.refreshValues(seasonId);
  }
}
