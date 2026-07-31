# 05 — Backlog por sprints

> Plan de ejecución del proyecto completo, de la investigación a producción. Traduce el
> [`02_ROADMAP.md`](02_ROADMAP.md) (fases) a **sprints** con objetivos, historias y criterios
> de hecho. **Ningún sprint de implementación arranca sin sus ADRs aprobados** (regla 4 de
> [`../CLAUDE.md`](../CLAUDE.md)) — por eso los ADRs están planificados dentro del backlog.

---

## Supuestos de planificación

| Parámetro | Supuesto (ajustable) |
|-----------|----------------------|
| Equipo | Dev en solitario + asistencia IA |
| Duración de sprint | 2 semanas |
| Alcance de arranque | 1 liga (multi-liga por diseño, se activa después) |
| Estrategia | MVP de **jugadores** primero; **entrenadores** y **estadio** después |
| Horizonte a beta | ~16-18 sprints (≈ 8-9 meses) |

> Las estimaciones son **unidades de trabajo relativas**, no fechas cerradas. Si cambian el
> equipo o la cadencia, se recalibra el calendario sin tocar la secuencia lógica.

## Cómo se lee este backlog

- **Épicas (E1–E10):** grandes bloques de valor. Atraviesan varios sprints.
- **Milestones (M1–M6):** puntos de control mostrables/testeables.
- **DoD:** *Definition of Done* del sprint (qué debe ser verdad al cerrarlo).
- Los **ADR-XXX** son decisiones a documentar y aprobar (ver [`../adr/`](../adr/)).

---

## Épicas

| # | Épica | Descripción |
|---|-------|-------------|
| **E1** | Fundación & decisiones | Investigación de datos, ADRs de arquitectura, tooling, repo, CI. |
| **E2** | Football Data Hub | Modelo de datos, ingesta, normalización, sincronización proveedor → BD propia. |
| **E3** | Backend core | Auth, usuarios, ligas privadas, API interna. |
| **E4** | Motor Fantasy — Jugadores | Plantilla, alineación, **puntuación** por jornada, clasificaciones. |
| **E5** | Mercado & economía | Compra/venta, pujas, valoraciones, saldo y transacciones. |
| **E6** | Entrenadores | Modelo, mercado y **algoritmo propio** de puntuación. |
| **E7** | Estadio | Progresión, mejoras y modificadores pasivos. |
| **E8** | Frontend app | App web completa sobre la API (más allá de la landing). |
| **E9** | Calidad & plataforma | Tests, seguridad, rendimiento, observabilidad, CI/CD, admin. |
| **E10** | Beta & lanzamiento | Beta cerrada, pulido y producción. |

## Milestones

| Milestone | Se alcanza tras | Qué demuestra |
|-----------|-----------------|---------------|
| **M1 — Data Hub vivo** | Sprint 3 | Datos propios de 1 liga, sincronizándose solos. |
| **M2 — Backend jugable** | Sprint 8 | Jugadores + mercado + puntuación por API. |
| **M3 — MVP web jugable** | Sprint 10 | Fantasy de jugadores completo en web. **Primera versión testeable.** |
| **M4 — Diferencial completo** | Sprint 14 | Entrenadores + estadio integrados. |
| **M5 — Beta** | Sprint 16 | Testers reales jugando jornadas completas. |
| **M6 — Producción** | Sprint 17 | Lanzamiento. |

---

## Backlog por sprints

### Sprint 0 — Fundación & decisiones *(Fase 0→1 · E1)*
**Objetivo:** cerrar la investigación de datos y las decisiones base de arquitectura; dejar el repo y el CI listos.
- Investigar proveedores de datos y cerrar `research/` (APIs, scraping, legal, costes) → **ADR-001 proveedor(es) de datos**.
- **ADR-002** framework backend (NestJS vs. Fastify/Hono). **ADR-003** ORM (Prisma vs. Drizzle).
- **ADR-004** estructura de repo (monorepo: `web` + `api` + `packages/*`; herramienta: pnpm workspaces/Turborepo).
- **ADR-005** estrategia de sincronización (jobs/cron/colas, workers).
- Tooling: integrar la `web/` actual al monorepo, ESLint/Prettier compartidos, gestión de `.env`, **CI en GitHub Actions** (lint + typecheck + test), proyecto en Railway + Postgres local (sin Docker).

**DoD:** ADRs 001-005 aprobados; monorepo funcionando; CI en verde; `research/` con conclusiones.

### Sprint 1 — Modelo de dominio & esquema BD *(Fase 2 · E2)*
**Objetivo:** definir el dominio y materializarlo en la base de datos propia.
- Documento de dominio: `Competition, Season, Team, Player, Coach, Match, MatchEvent, Lineup, Injury, Suspension, ProviderMapping…`
- **Esquema Prisma + migraciones**; **IDs internos** y tablas de mapeo a IDs externos.
- Diagrama ER documentado. **ADR-006 modelo de jugadores** (mapeo multi-proveedor).

**DoD:** esquema migrado en Postgres; ERD en `docs/`; seed mínimo.

### Sprint 2 — Data Hub: proveedor `mock` + ingesta base *(Fase 3 · E2)*
**Objetivo:** traer datos maestros realistas de 1 liga a nuestra BD con IDs internos, **a coste €0** (ver [ADR-001](../adr/ADR-001.md)).
- **Interfaz de proveedor** (capa anticorrupción) + **primer adaptador: `mock`**.
- **Seed realista** de **LaLiga (Primera División española)**: equipos y plantillas (sembrado una vez desde fuentes libres o generado).
- **Simulador de partidos/eventos** (base): resultados y eventos plausibles.
- Backfill inicial desde el mock: competiciones, equipos, jugadores, entrenadores, calendario → normalización a BD propia.

**DoD:** 1 liga (simulada, realista) en BD; backfill **idempotente**; arquitectura del Hub validada.

### Sprint 3 — Data Hub: sync incremental & eventos *(Fase 3 · E2)* → **M1**
**Objetivo:** que los datos vivos se actualicen solos tras cada jornada (alimentados por el simulador).
- Jobs programados que consumen el mock/simulador: resultados, eventos, alineaciones, sustituciones, lesiones, sanciones, cambios de entrenador.
- Simular jornadas/temporadas a demanda (fast-forward) para testing.
- Idempotencia, reintentos, logging y **alertas de fallo**; estado/observabilidad del sync.

**DoD:** datos post-jornada actualizándose automáticamente; poder simular una temporada completa. **🏁 M1**

### Sprint 4 — Backend core: auth & usuarios *(Fase 4 · E3)*
**Objetivo:** cimientos de la API y autenticación.
- Scaffold de la API (framework del ADR-002), estructura modular.
- Auth: registro, login, verificación de email, sesiones/JWT, recuperación de contraseña.
- Modelo de usuario y perfil. **ADR-007 diseño de API** (REST vs. GraphQL).

**DoD:** auth de extremo a extremo con tests.

### Sprint 5 — Ligas privadas & estructura de juego *(Fase 4 · E3)*
**Objetivo:** que los usuarios organicen su competición.
- Crear/unirse a **ligas privadas**, invitaciones, membresías y rol de admin de liga.
- Temporada y **jornadas del juego** vinculadas a los datos reales.

**DoD:** un usuario crea una liga e invita a otros; jornadas mapeadas a la realidad.

### Sprint 6 — Motor Fantasy: plantilla & alineación *(Fase 6 · E4)*
**Objetivo:** que el usuario tenga equipo y lo alinee.
- Plantilla por usuario, presupuesto inicial, asignación inicial de jugadores.
- **Alineación:** formaciones, validación de reglas, 11 titular + banquillo.

**DoD:** el usuario arma su plantilla y guarda su alineación válida.

### Sprint 7 — Motor de puntuación de jugadores *(Fase 6 · E4)* — **núcleo**
**Objetivo:** convertir el fútbol real en puntos Fantasy.
- **ADR-008 sistema de puntuación** de jugadores (reglas a partir de eventos reales).
- Ciclo de jornada: **lock → compute → publish**.
- Clasificaciones/standings de liga.

**DoD:** al cerrar una jornada real, los usuarios reciben puntos y ranking correctos.

### Sprint 8 — Mercado & economía *(Fase 6 · E5)* → **M2**
**Objetivo:** dar vida económica al juego.
- Listados de mercado, **valoraciones** de jugadores.
- Compra/venta, **pujas/subastas**, cláusulas (simple), transacciones y saldo.
- **ADR-009 economía del juego** (dinero, valores, inflación).

**DoD:** mercado operativo con economía coherente por API. **🏁 M2**

### Sprint 9 — Frontend app I: núcleo jugable *(Fase 5 · E8)*
**Objetivo:** llevar el bucle central a la web.
- Design system a partir de la marca; componentes base.
- Pantallas: login/registro, dashboard, **plantilla**, **alineación** (mockup previsto), clasificación.
- Integración con la API.

**DoD:** flujo jugable en web: alinear y ver puntos de la jornada.

### Sprint 10 — Frontend app II: mercado *(Fase 5 · E8)* → **M3**
**Objetivo:** completar el MVP de jugadores en web.
- UI de mercado, pujas, ficha de jugador, historial de transacciones.

**DoD:** Fantasy de jugadores **completo y testeable** en web. **🏁 M3 (MVP)**

### Sprint 11 — Entrenadores: modelo & algoritmo *(Fase 7 · E6)*
**Objetivo:** diseñar la mecánica diferencial nº1.
- Modelo de entrenadores y su mercado.
- **ADR-011 algoritmo de puntuación de entrenadores** (diseño + **validación offline con datos reales**).

**DoD:** algoritmo definido, documentado y validado contra jornadas históricas.

### Sprint 12 — Entrenadores: integración *(Fase 7 · E6)*
**Objetivo:** que el banquillo puntúe.
- Integrar entrenadores en el ciclo de jornada y en el total del equipo.
- UI de entrenadores (mercado, ficha, aportación).

**DoD:** los entrenadores puntúan y afectan al resultado, en API y web.

### Sprint 13 — Estadio: progresión & modificadores *(Fase 8 · E7)*
**Objetivo:** diseñar la mecánica diferencial nº2.
- Modelo de estadio, mejoras, árbol de progresión.
- **Modificadores pasivos** y su aplicación al scoring. **ADR-013 balance del estadio**.

**DoD:** motor de estadio con modificadores aplicándose al cálculo.

### Sprint 14 — Estadio: UI & balance global *(Fase 8 · E7)* → **M4**
**Objetivo:** cerrar los tres pilares y equilibrarlos.
- UI de estadio (mockup previsto): construir/mejorar.
- **Ajuste de balance económico global** (jugadores + entrenadores + estadio).

**DoD:** estadio jugable; los tres pilares conviven equilibrados. **🏁 M4**

### Sprint 15 — Endurecimiento: seguridad, rendimiento, observabilidad *(E9)*
**Objetivo:** dejarlo listo para usuarios reales.
- Hardening de auth, rate limiting, validación de entrada, gestión de secretos, **RGPD/consentimiento**.
- Rendimiento: índices de BD, **caché Redis** en lecturas calientes, colas de trabajo.
- Logging/monitoring/error tracking; **panel de administración** (gestión de ligas, correcciones de datos).
- Cobertura de tests (unit/integration/e2e) y CI reforzada.

**DoD:** la plataforma resiste uso real; observabilidad y admin operativos.

### Sprint 16 — Beta cerrada *(Fase 9 · E10)* → **M5**
**Objetivo:** jugar de verdad con testers, sobre **datos reales**.
- **Integrar el adaptador real (API-Football)** sustituyendo al `mock` — **sin tocar backend
  ni frontend** (validación final del Data Hub); alta del plan de pago (~$19/mes).
- Onboarding, feedback in-app, soporte, correcciones de datos en caliente.
- Ejecutar **jornadas reales completas** con un grupo piloto.

**DoD:** el adaptador real alimenta el juego; testers reales completan jornadas de principio a fin; bugs priorizados. **🏁 M5**

### Sprint 17 — Pulido & lanzamiento *(Fase 10 · E10)* → **M6**
**Objetivo:** producción.
- Corrección de bugs de beta, pulido UX/copys, rendimiento a escala.
- Infra de producción en Railway, **backups**, plan de incidencias.
- Lanzamiento controlado.

**DoD:** Gambetea en producción. **🏁 M6**

---

## Backlog transversal (continuo, en todos los sprints)

- **Tests** junto al código (no como fase aparte); CI bloquea si fallan.
- **ADRs** al tomar cada decisión relevante; actualizar `DECISION_LOG.md`.
- **Documentación** viva en `docs/` de cada sistema al construirlo.
- **Seguridad** y **accesibilidad** como requisitos, no extras.

## Riesgos principales a vigilar

1. **Proveedor de datos** (Sprint 0): coste/legalidad/cobertura pueden forzar rediseño de estrategia. Es el riesgo nº1 — por eso va primero.
2. **Algoritmo de entrenadores** (Sprint 11): es I+D; puede requerir varias iteraciones de validación.
3. **Balance económico** (Sprints 8/14): mezclar tres economías (jugadores, entrenadores, estadio) sin romper el juego.
4. **Sincronización en vivo** (Sprint 3): fiabilidad de los datos post-jornada es crítica para la confianza del usuario.

## Próximo paso inmediato

**Sprint 0.** Y dentro de él, lo primero: la **investigación de proveedores de datos** para redactar el **ADR-001**, que desbloquea todo lo demás.
