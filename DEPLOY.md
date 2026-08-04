# Despliegue en Railway (Gambetea)

Monorepo **pnpm + Turborepo** con dos apps: `apps/api` (NestJS) y `apps/web` (Next.js), y una base
de datos **Postgres**. En Railway se montan **3 servicios** dentro de un mismo proyecto: Postgres,
API y Web.

> Local se queda en `mock`. **Producción** usa datos reales (`DATA_PROVIDER=api-football`).

---

## 0. Subir el proyecto a GitHub

Ya hay un commit inicial hecho en local. Solo falta crear el repo remoto y empujar:

```bash
# crea un repo VACÍO en github.com (sin README) y copia su URL, luego:
git remote add origin https://github.com/TU_USUARIO/gambetea.git
git branch -M main
git push -u origin main
```

Los secretos **no se suben** (`.env` está en `.gitignore`); en su lugar hay `.env.example`.

---

## 1. Proyecto + Postgres en Railway

1. Entra en [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** →
   elige tu repo.
2. Dentro del proyecto: **New** → **Database** → **Add PostgreSQL**. Railway crea la BD y expone la
   variable `DATABASE_URL` (la referenciaremos desde la API).

---

## 2. Servicio API (`apps/api`)

Crea un servicio desde el repo (o usa el que Railway creó) y en **Settings** pon:

- **Build Command:**
  ```
  pnpm install --frozen-lockfile && pnpm --filter api exec prisma generate && pnpm --filter api build
  ```
- **Start Command:**
  ```
  pnpm --filter api exec prisma migrate deploy && node apps/api/dist/main.js
  ```
  (aplica migraciones en cada arranque — es idempotente — y levanta la API en `$PORT`).

- **Variables** (Settings → Variables):
  | Variable | Valor |
  |---|---|
  | `DATABASE_URL` | referencia a la del Postgres (`${{Postgres.DATABASE_URL}}`) |
  | `JWT_SECRET` | un secreto largo y aleatorio |
  | `DATA_PROVIDER` | `api-football` |
  | `APIFOOTBALL_KEY` | tu key gratuita de api-football |
  | `APIFOOTBALL_LEAGUE` | `140` (LaLiga) |
  | `APIFOOTBALL_SEASON` | `2023` (temporada 2023/24) |

- **Networking → Generate Domain**: genera la URL pública de la API (p. ej.
  `https://gambetea-api.up.railway.app`). La necesitarás para el web.

---

## 3. Servicio Web (`apps/web`)

**New** → **GitHub Repo** (el mismo) → segundo servicio. En **Settings**:

- **Build Command:**
  ```
  pnpm install --frozen-lockfile && pnpm --filter web build
  ```
- **Start Command:**
  ```
  pnpm --filter web start
  ```
- **Variables:**
  | Variable | Valor |
  |---|---|
  | `NEXT_PUBLIC_API_URL` | `https://TU-API.up.railway.app/api` (la URL del servicio API + `/api`) |

  > ⚠️ `NEXT_PUBLIC_*` se **incrusta en tiempo de build**: si cambias la URL de la API, hay que
  > **volver a desplegar** el web.

- **Networking → Generate Domain**: la URL pública del juego.

---

## 4. Post-despliegue (una vez)

1. **Crear el admin** en la BD de producción. Desde la pestaña del servicio API en Railway, lanza un
   comando one-off (o añádelo temporalmente como Start):
   ```
   node apps/api/scripts/seed-admin.mjs admin nimda Admin
   ```
   Crea la cuenta `admin` / `nimda` con rol de administrador global.

2. **Entra al juego** con `admin` / `nimda`, ve a **Administración → Hub de datos** y:
   - **Rellenar desde API** → baja equipos, plantillas y calendario reales de LaLiga (~50 req).
   - **Jugar jornadas** → ingiere y puntúa jornadas reales (≈30 req/jornada; el plan free son
     100/día, así que ~3 jornadas/día).

   (Si algún día quieres empezar de cero: **Inicializar** borra todos los datos del juego menos las
   cuentas de usuario, y vuelves a **Rellenar**.)

---

## Página de mantenimiento

Para cortar el acceso durante una intervención planificada, en el servicio **web** pon la variable
`MAINTENANCE=1` y reinícialo (**Deployments → Restart**): la web mostrará "Volvemos enseguida" en
todas las rutas. Para quitarlo, borra la variable y reinicia. (Se lee en el servidor en tiempo de
ejecución, así que **no** hace falta reconstruir.)

> En un despliegue normal Railway mantiene la versión antigua sirviendo hasta que la nueva está
> lista, así que la caída es mínima; la página de mantenimiento es para paradas a propósito.

## Notas

- **Prisma client**: está gitignoreado (`generated/`), por eso el build corre `prisma generate`
  antes de compilar.
- **Puerto/CORS**: la API escucha en `$PORT` y tiene CORS abierto — compatible con Railway.
- **pnpm**: Railway (Nixpacks) detecta pnpm por el `pnpm-lock.yaml`. Si diera problemas de versión,
  añade `"packageManager": "pnpm@X.Y.Z"` en el `package.json` raíz.
- **Presupuesto API-Football (free)**: 100 req/día. El sync es por lotes, así que sobra para
  probar; para uso en vivo continuo, subir al plan Pro ($19/mes) — mismo código.
- **Rotar keys**: `APIFOOTBALL_KEY` y `OPENAI_API_KEY` se compartieron por chat → regénralas.
