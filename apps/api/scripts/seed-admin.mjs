// Crea (o actualiza) la cuenta de ADMINISTRADOR GLOBAL. Reutilizable en local y en producción.
// Uso:  node scripts/seed-admin.mjs [email] [password] [displayName]
// Por defecto: admin / nimda / Admin. Requiere la API compilada a dist (npx nest build) y
// DATABASE_URL en el entorno o en apps/api/.env.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const email = process.argv[2] ?? "admin";
const password = process.argv[3] ?? "nimda";
const displayName = process.argv[4] ?? "Admin";

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(join(apiDir, ".env"), "utf8");
    process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g, "").trim();
  } catch {
    console.error("Falta DATABASE_URL (ni en el entorno ni en apps/api/.env)");
    process.exit(1);
  }
}

const bcrypt = require(join(apiDir, "node_modules/bcryptjs"));
const { PrismaPg } = require(join(apiDir, "node_modules/@prisma/adapter-pg"));
const { PrismaClient } = require(join(apiDir, "dist/generated/prisma/client.js"));
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

const passwordHash = bcrypt.hashSync(password, 10);
const user = await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, displayName, isAdmin: true },
  update: { passwordHash, isAdmin: true },
  select: { email: true, isAdmin: true },
});
console.log(`OK · admin global: ${user.email} (isAdmin=${user.isAdmin}) · contraseña actualizada.`);
await prisma.$disconnect();
