// Promueve un usuario a administrador global (ADR-016).
// Uso: node scripts/make-admin.mjs <email>   (desde apps/api, con la API ya compilada a dist)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/make-admin.mjs <email>");
  process.exit(1);
}

const env = readFileSync(join(apiDir, ".env"), "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g, "").trim();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require(join(apiDir, "dist/generated/prisma/client.js"));
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

const user = await prisma.user.update({ where: { email }, data: { isAdmin: true } }).catch((e) => {
  console.error("No se pudo promover:", e.message);
  process.exit(1);
});
console.log(`OK · ${user.email} ahora es administrador global.`);
await prisma.$disconnect();
