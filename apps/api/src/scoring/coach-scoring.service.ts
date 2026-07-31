import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { coachPointsFromFacts, defaultCoachConfig, resultFacts } from "./coach.rules";

@Injectable()
export class CoachScoringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula los HECHOS de cada entrenador cuyo equipo jugó (resultado + roja directa/doble,
   * remontada/perder ganando, gol/expulsión de suplente) y los guarda en el breakdown. La
   * puntuación por defecto se guarda en `points` (referencia); cada liga aplica su baremo al
   * agregar el total del equipo. Idempotente.
   */
  async computeCoachScores(gameweekId: string): Promise<number> {
    const matches = await this.prisma.match.findMany({
      where: { gameweekId },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
        events: { select: { playerId: true, type: true, minute: true } },
      },
    });
    if (matches.length === 0) return 0;

    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const coaches = await this.prisma.coach.findMany({ where: { teamId: { in: teamIds } }, select: { id: true, teamId: true } });
    const coachByTeam = new Map(coaches.map((c) => [c.teamId, c.id]));

    const eventPlayerIds = [...new Set(matches.flatMap((m) => m.events.map((e) => e.playerId).filter((x): x is string => !!x)))];
    const players = await this.prisma.player.findMany({ where: { id: { in: eventPlayerIds } }, select: { id: true, teamId: true } });
    const teamOf = new Map(players.map((p) => [p.id, p.teamId]));

    const cfg = defaultCoachConfig();
    const rows: { coachId: string; gameweekId: string; points: number; breakdown: object }[] = [];

    for (const m of matches) {
      const hg = m.homeGoals ?? 0;
      const ag = m.awayGoals ?? 0;

      // Agregados por jugador en el partido.
      const yellow = new Map<string, number>();
      const red = new Set<string>();
      const subIn = new Set<string>();
      const goalScorers: string[] = [];
      const timeline: { minute: number; team: string | null }[] = [];
      for (const e of m.events) {
        if (!e.playerId) continue;
        const pteam = teamOf.get(e.playerId) ?? null;
        switch (e.type) {
          case "YELLOW": yellow.set(e.playerId, (yellow.get(e.playerId) ?? 0) + 1); break;
          case "RED": red.add(e.playerId); break;
          case "SUB_IN": subIn.add(e.playerId); break;
          case "GOAL":
          case "PEN_SCORED":
            goalScorers.push(e.playerId);
            timeline.push({ minute: e.minute, team: pteam });
            break;
          case "OWN_GOAL":
            timeline.push({ minute: e.minute, team: pteam === m.homeTeamId ? m.awayTeamId : m.homeTeamId });
            break;
        }
      }
      // Reconstrucción del marcador para detectar remontada / perder ganando.
      timeline.sort((a, b) => a.minute - b.minute);
      let hs = 0, as = 0, homeBehind = false, homeAhead = false, awayBehind = false, awayAhead = false;
      for (const g of timeline) {
        if (g.team === m.homeTeamId) hs++;
        else if (g.team === m.awayTeamId) as++;
        if (hs < as) { homeBehind = true; awayAhead = true; }
        if (hs > as) { homeAhead = true; awayBehind = true; }
      }

      const sideFacts = (teamId: string, gf: number, ga: number, isHome: boolean, behind: boolean, ahead: boolean) => {
        const f = resultFacts(gf, ga, isHome);
        let redDirect = 0, doubleYellow = 0, subGoal = 0, subRed = 0;
        for (const pid of red) {
          if (teamOf.get(pid) !== teamId) continue;
          if ((yellow.get(pid) ?? 0) >= 2) doubleYellow++;
          else redDirect++;
          if (subIn.has(pid)) subRed++;
        }
        for (const pid of goalScorers) {
          if (teamOf.get(pid) === teamId && subIn.has(pid)) subGoal++;
        }
        const won = gf > ga, lost = gf < ga;
        return {
          ...f,
          redDirect,
          doubleYellow,
          subGoal,
          subRed,
          comeback: behind && won ? 1 : 0,
          blownLead: ahead && lost ? 1 : 0,
        };
      };

      const homeCoach = coachByTeam.get(m.homeTeamId);
      const awayCoach = coachByTeam.get(m.awayTeamId);
      if (homeCoach) {
        const f = sideFacts(m.homeTeamId, hg, ag, true, homeBehind, homeAhead);
        rows.push({ coachId: homeCoach, gameweekId, points: coachPointsFromFacts(f, cfg), breakdown: f });
      }
      if (awayCoach) {
        const f = sideFacts(m.awayTeamId, ag, hg, false, awayBehind, awayAhead);
        rows.push({ coachId: awayCoach, gameweekId, points: coachPointsFromFacts(f, cfg), breakdown: f });
      }
    }

    await this.prisma.coachGameweekScore.deleteMany({ where: { gameweekId } });
    if (rows.length) await this.prisma.coachGameweekScore.createMany({ data: rows });
    return rows.length;
  }
}
