import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { coachValueFromStrength, computeValue } from "./economy.rules";

@Injectable()
export class ValuationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula el valor de todos los jugadores de la temporada:
   * valor = base(posición) + puntos_temporada × factor. Idempotente.
   */
  async refreshValues(seasonId: string): Promise<number> {
    // Equipos de la temporada (vía partidos) y sus jugadores.
    const matches = await this.prisma.match.findMany({
      where: { seasonId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const players = await this.prisma.player.findMany({
      where: { teamId: { in: teamIds } },
      select: { id: true, rating: true, teamId: true },
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

    // Un solo UPDATE masivo (VALUES) — evita cientos de updates y el timeout de transacción.
    await this.bulkUpdateValues(
      "Player",
      players.map((p) => [p.id, computeValue(p.rating, pointsOf.get(p.id) ?? 0)]),
    );

    // Entrenadores: valor = base por FUERZA de su equipo (rating medio) + puntos × factor.
    const coaches = await this.prisma.coach.findMany({ where: { teamId: { in: teamIds } }, select: { id: true, teamId: true } });
    const coachGrouped = await this.prisma.coachGameweekScore.groupBy({
      by: ["coachId"],
      where: { gameweek: { seasonId } },
      _sum: { points: true },
    });
    const coachPointsOf = new Map(coachGrouped.map((g) => [g.coachId, g._sum.points ?? 0]));
    await this.bulkUpdateValues(
      "Coach",
      coaches.map((c) => [c.id, coachValueFromStrength(c.teamId ? (teamAvgRating.get(c.teamId) ?? 70) : 70, coachPointsOf.get(c.id) ?? 0)]),
    );
    return players.length;
  }

  /** UPDATE en bloque de `value` para muchas filas (ids cuid + enteros, seguro). */
  private async bulkUpdateValues(table: "Player" | "Coach", rows: [string, number][]): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map(([id, v]) => `('${id}',${Math.round(v)})`).join(",");
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${table}" AS t SET value = v.val FROM (VALUES ${values}) AS v(id, val) WHERE t.id = v.id`,
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
