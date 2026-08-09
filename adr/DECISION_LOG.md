# Registro de decisiones (Decision Log)

> Índice cronológico de todos los ADRs. Una línea por decisión. Antes de proponer un ADR
> nuevo, revisar este registro para no contradecir decisiones ya tomadas.

| ADR | Título | Estado | Fase | Fecha |
|:---:|--------|--------|:----:|-------|
| [001](ADR-001.md) | Proveedor de datos (mock en dev · API-Football al mercado) | Aceptado | 0 | 2026-07-27 |
| [002](ADR-002.md) | Framework de backend (NestJS) | Aceptado | 0 | 2026-07-27 |
| [003](ADR-003.md) | ORM (Prisma 7) | Aceptado | 0 | 2026-07-27 |
| [004](ADR-004.md) | Estructura de repositorio (monorepo pnpm + Turborepo) | Aceptado | 0 | 2026-07-27 |
| [005](ADR-005.md) | Sync del Data Hub + diseño del simulador (cron ahora · BullMQ al integrar API) | Aceptado | 0 | 2026-07-27 |
| [006](ADR-006.md) | Modelo de dominio y mapeo de IDs (ProviderMapping) | Aceptado | 2 | 2026-07-27 |
| [007](ADR-007.md) | Diseño de la API (REST/JSON con NestJS) | Aceptado | 4 | 2026-07-28 |
| [008](ADR-008.md) | Sistema de puntuación de jugadores (reglas por evento · lock→compute) | Aceptado | 6 | 2026-07-28 |
| [009](ADR-009.md) | Economía del juego (valores por rendimiento · subasta + venta + cláusula) | Aceptado | 6 | 2026-07-28 |
| [010](ADR-010.md) | Ciclo temporal automático (snapshot T−30min · puntos+primas fin de jornada · mercado 00:00) | Aceptado | 6 | 2026-07-28 |
| [011](ADR-011.md) | Algoritmo de puntuación de entrenadores (resultado + modificadores) | Aceptado | 7 | 2026-07-28 |
| [012](ADR-012.md) | Economía v2: salarios (sumidero) · plantilla sin límite · mercado de entrenadores | Aceptado | 7 | 2026-07-29 |
| [013](ADR-013.md) | Estadio: progresión lineal + ingreso por asistencia (€/punto por nivel) | Aceptado | 8 | 2026-07-29 |
| [014](ADR-014.md) | Configuración económica por liga (reglas como datos) + Derechos de TV | Propuesto | 8 | 2026-07-30 |
| [015](ADR-015.md) | Baremo enriquecido de jugadores por posición + simulador de estadísticas (configurable por liga) | Propuesto | 8 | 2026-07-30 |
| [016](ADR-016.md) | Rol de administrador global + panel de overrides (god-mode del Hub) con auditoría | Propuesto | 8 | 2026-07-30 |
| [017](ADR-017.md) | Recalibración económica con el baremo enriquecido (valor-por-punto, salario, prima, compensación) | Propuesto | 8 | 2026-07-30 |
| [018](ADR-018.md) | Ciclo de vida del jugador (reconciliación del Hub: traspaso-fuera/jubilación/cambio club-posición) + feed de noticias | Propuesto | 8 | 2026-07-31 |
| [019](ADR-019.md) | Adaptador api-football (datos reales, capa gratuita) + estrategia de prueba con temporada pasada | Propuesto | 0→1 | 2026-07-31 |
| [020](ADR-020.md) | Aplazamientos: liquidación parcial (delta) por partido (extiende ADR-010) | Propuesto | 6→1 | 2026-08-09 |

## Cómo se usa

1. Copia [`ADR_TEMPLATE.md`](ADR_TEMPLATE.md) a `adr/ADR-NNN.md` (numeración correlativa).
2. Rellénalo: contexto, opciones, decisión justificada, consecuencias.
3. Añade una fila a la tabla de arriba.
4. Si una decisión reemplaza a otra, marca la antigua como *Supersedida por ADR-XXX* (no la
   borres: el histórico es parte del valor).

## Candidatos a ADR ya identificados

Estos temas necesitarán un ADR cuando lleguemos a decidirlos:

- **ADR-001 (previsible):** Proveedor(es) principal(es) de datos — salida de la Fase 0.
- Backend framework (NestJS vs. alternativas).
- ORM (Prisma vs. alternativas).
- Estrategia de sincronización del Football Data Hub.
- Modelo de datos de jugadores (mapeo multi-proveedor con IDs internos).
- Modelo/algoritmo de puntuación de entrenadores.
