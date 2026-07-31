// Validación OFFLINE del algoritmo de puntuación de entrenadores (ADR-011).
// Simula la temporada completa y reporta el ranking de entrenadores + estadísticas,
// para comprobar que diferencia bien y correlaciona con el rendimiento de los equipos.
// Ejecutar: pnpm --filter api validate:coaches
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { MockProvider } from "../data-hub/providers/mock/mock.provider";
import { playThrough } from "../data-hub/sync";
import { coachPointsFromFacts, defaultCoachConfig, resultFacts } from "./coach.rules";

const COACH_CFG = defaultCoachConfig();

interface CoachAgg {
  name: string;
  team: string;
  games: number;
  total: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
  const provider = new MockProvider();

  const season = await prisma.season.findFirst({ where: { current: true } });
  if (!season) throw new Error("No hay temporada activa");

  console.log("Simulando la temporada completa (puede tardar)…");
  await playThrough(prisma, provider, 40); // juega todas las jornadas no finalizadas

  const matches = await prisma.match.findMany({
    where: { seasonId: season.id, status: "FINISHED" },
    select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
  });
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const coaches = await prisma.coach.findMany({ where: { teamId: { not: null } }, select: { name: true, teamId: true } });

  const agg = new Map<string, CoachAgg>();
  for (const c of coaches) {
    agg.set(c.teamId!, { name: c.name, team: teamName.get(c.teamId!) ?? "?", games: 0, total: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });
  }

  const accumulate = (teamId: string, gf: number, ga: number, isHome: boolean) => {
    const a = agg.get(teamId);
    if (!a) return;
    const points = coachPointsFromFacts(resultFacts(gf, ga, isHome), COACH_CFG);
    a.games++;
    a.total += points;
    a.gf += gf;
    a.ga += ga;
    if (gf > ga) a.wins++;
    else if (gf === ga) a.draws++;
    else a.losses++;
  };

  for (const m of matches) {
    const hg = m.homeGoals ?? 0;
    const ag = m.awayGoals ?? 0;
    accumulate(m.homeTeamId, hg, ag, true);
    accumulate(m.awayTeamId, ag, hg, false);
  }

  const rows = [...agg.values()].filter((a) => a.games > 0).sort((x, y) => y.total - x.total);

  console.log(`\nJornadas simuladas · ${matches.length} partidos · ${rows.length} entrenadores\n`);
  console.log("  #  Entrenador           Equipo               PJ   G  E  P   GF  GC   PTS   media");
  console.log("  ─────────────────────────────────────────────────────────────────────────────────");
  rows.forEach((a, i) => {
    const avg = (a.total / a.games).toFixed(1);
    console.log(
      `  ${String(i + 1).padStart(2)}  ${a.name.padEnd(20).slice(0, 20)} ${a.team.padEnd(20).slice(0, 20)} ` +
        `${String(a.games).padStart(2)}  ${String(a.wins).padStart(2)} ${String(a.draws).padStart(2)} ${String(a.losses).padStart(2)}  ` +
        `${String(a.gf).padStart(3)} ${String(a.ga).padStart(3)}  ${String(a.total).padStart(4)}  ${avg.padStart(6)}`,
    );
  });

  // Estadísticas de dispersión + correlación con puntos deportivos (3·V + E).
  const totals = rows.map((a) => a.total);
  const mean = totals.reduce((s, v) => s + v, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((s, v) => s + (v - mean) ** 2, 0) / totals.length);
  const sporting = rows.map((a) => a.wins * 3 + a.draws); // puntos "reales" de liga
  const corr = pearson(totals, sporting);

  console.log("\nEstadísticas:");
  console.log(`  Media ${mean.toFixed(1)} · Desv. típica ${sd.toFixed(1)} · Rango [${Math.min(...totals)}, ${Math.max(...totals)}]`);
  console.log(`  Correlación con puntos reales de liga (3·V+E): ${corr.toFixed(3)} (esperado alto y positivo)`);
  console.log(`  Mejor: ${rows[0].name} (${rows[0].team}) ${rows[0].total} · Peor: ${rows[rows.length - 1].name} (${rows[rows.length - 1].team}) ${rows[rows.length - 1].total}`);

  await prisma.$disconnect();
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
