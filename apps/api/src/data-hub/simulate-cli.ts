// Fast-forward de jornadas (mock). Ejecutar: pnpm --filter api db:simulate [n]  (por defecto 1)
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { MockProvider } from "./providers/mock/mock.provider";
import { playThrough } from "./sync";

async function main() {
  const count = Math.max(1, Number(process.argv[2] ?? "1"));
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
  const provider = new MockProvider();

  console.log(`Simulando hasta ${count} jornada(s)…`);
  const t0 = Date.now();
  const results = await playThrough(prisma, provider, count);
  for (const r of results) {
    console.log(`  Jornada ${r.matchday}: ${r.matches} partidos, ${r.events} eventos`);
  }

  const [finished, events, apps] = await Promise.all([
    prisma.match.count({ where: { status: "FINISHED" } }),
    prisma.matchEvent.count(),
    prisma.appearance.count(),
  ]);
  console.log(
    `OK en ${((Date.now() - t0) / 1000).toFixed(1)}s · jugadas ${results.length} · ` +
      `BD: ${finished} partidos finalizados, ${events} eventos, ${apps} apariciones`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
