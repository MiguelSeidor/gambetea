// CLI de backfill del Data Hub. Ejecutar: pnpm --filter api db:backfill
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { createProvider } from "./providers/provider.factory";
import { backfill } from "./sync";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
  const provider = createProvider();
  console.log(`Backfill desde el proveedor "${provider.name}"…`);
  const t0 = Date.now();
  const summary = await backfill(prisma, provider);
  console.log(`Backfill OK en ${((Date.now() - t0) / 1000).toFixed(1)}s:`, summary);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
