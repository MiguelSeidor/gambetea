// Seed mínimo (LaLiga) — Sprint 1. Idempotente: si ya existe LaLiga, no hace nada.
// Ejecutar: pnpm --filter api exec tsx prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type Position = "GK" | "DEF" | "MID" | "FWD";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const TEAMS = ["Real Madrid", "Barcelona", "Atlético", "Athletic", "Real Sociedad", "Villarreal"];

async function main() {
  const existing = await prisma.competition.findFirst({ where: { name: "LaLiga" } });
  if (existing) {
    console.log("LaLiga ya sembrada — nada que hacer.");
    return;
  }

  const comp = await prisma.competition.create({ data: { name: "LaLiga", country: "España" } });
  const season = await prisma.season.create({
    data: { competitionId: comp.id, name: "2025/26", current: true },
  });

  const teams = [];
  for (const name of TEAMS) {
    teams.push(await prisma.team.create({ data: { name, shortName: name.slice(0, 3).toUpperCase() } }));
  }

  // Jugadores y entrenador para los dos primeros equipos
  const sample: Array<[string, Position]> = [
    ["Portero", "GK"], ["Defensa", "DEF"], ["Central", "DEF"], ["Medio", "MID"], ["Delantero", "FWD"],
  ];
  for (const team of teams.slice(0, 2)) {
    for (const [role, pos] of sample) {
      await prisma.player.create({ data: { teamId: team.id, name: `${role} ${team.shortName}`, position: pos } });
    }
    await prisma.coach.create({ data: { teamId: team.id, name: `Entrenador ${team.shortName}` } });
  }

  // Primera jornada
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  await prisma.gameweek.create({ data: { seasonId: season.id, number: 1, deadline } });

  // Ejemplo de mapeo del proveedor mock
  await prisma.providerMapping.create({
    data: { provider: "mock", entityType: "competition", externalId: "laliga-2025", internalId: comp.id },
  });

  const counts = {
    equipos: await prisma.team.count(),
    jugadores: await prisma.player.count(),
    entrenadores: await prisma.coach.count(),
    jornadas: await prisma.gameweek.count(),
  };
  console.log("Seed OK:", counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
