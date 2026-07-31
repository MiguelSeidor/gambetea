# 01 — Stack tecnológico

> ⚠️ **Tentativo.** Cada elección marcada como *(pendiente de validar)* debe cerrarse con un
> ADR antes de considerarse definitiva. Este documento refleja el punto de partida, no una
> verdad inamovible.

---

## Estado de cada decisión

| Capa | Tecnología | Estado |
|------|------------|--------|
| Frontend framework | **React** | Partida |
| Meta-framework | **Next.js** | Partida |
| Estilos | **Tailwind CSS** | Partida |
| Componentes UI | **shadcn/ui** | Partida |
| Backend runtime | **Node.js** | Partida |
| Backend framework | **NestJS** | ✅ Decidido ([ADR-002](../adr/ADR-002.md)) |
| Base de datos | **PostgreSQL** | Partida |
| Hosting BD (dev) | **Neon** (Postgres gestionado, free) / Railway | ✅ Sin Docker, sin instalar ([ADR-005](../adr/ADR-005.md)) |
| ORM | **Prisma 7** | ✅ Decidido ([ADR-003](../adr/ADR-003.md)) |
| Cache | **Redis** | Partida |
| Contenedores | **Evitar Docker** | ❌ Descartado por preferencia (ver abajo) |
| Estructura | **Monorepo** (pnpm workspaces + Turborepo) | ✅ Decidido ([ADR-004](../adr/ADR-004.md)) |
| Gestor de paquetes | **pnpm** | ✅ Decidido ([ADR-004](../adr/ADR-004.md)) |
| Repositorio | **GitHub** | Partida |
| Entorno inicial | **Local** | Partida |
| Despliegue futuro | **Railway** | Partida |

## Restricciones de stack

- **NO usar Hostinger.** Nada en la arquitectura debe asumir ni depender de Hostinger.
- **Evitar Docker.** Preferencia explícita del proyecto: **no trabajar con Docker** salvo
  que no haya alternativa razonable. Railway despliega Node/Next mediante buildpacks
  (Nixpacks) sin necesidad de Dockerfile, y en local se corre con las herramientas nativas
  (`npm`/`pnpm`, Postgres y Redis como servicios locales o gestionados). Si algún día un
  problema concreto solo se resolviera bien con Docker, se abrirá un ADR que lo justifique.
- **Todo portable.** El stack debe poder correr en local y desplegarse en Railway (o
  equivalente) sin acoplarse a un proveedor concreto **y sin depender de Docker**.

## Decisiones cerradas (Sprint 0)

- ✅ **Proveedor de datos** → [ADR-001](../adr/ADR-001.md) (mock en dev · API-Football al mercado).
- ✅ **Framework backend: NestJS** → [ADR-002](../adr/ADR-002.md).
- ✅ **ORM: Prisma 7** → [ADR-003](../adr/ADR-003.md).
- ✅ **Monorepo (pnpm + Turborepo)** → [ADR-004](../adr/ADR-004.md).
- ✅ **Sync del Data Hub + simulador** (cron ahora · BullMQ gestionado al integrar API) → [ADR-005](../adr/ADR-005.md).

**Sprint 0 (decisiones fundacionales): cerrado.** Sin decisiones de arquitectura abiertas
hasta el modelo de dominio (ADR-006, Sprint 1).

## Nota

El stack no se congela aquí. A medida que la investigación (`research/`) aporte datos —por
ejemplo, sobre volumen de sincronización o costes— algunas piezas podrían revisarse. Cada
cambio, vía ADR.
