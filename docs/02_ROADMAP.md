# 02 — Roadmap

> El proyecto avanza **en orden**. No se salta de fase sin haber cerrado la anterior.
> Ninguna fase de implementación empieza sin los ADRs correspondientes aprobados.

> **Ejecución detallada:** ver [`05_BACKLOG.md`](05_BACKLOG.md) — traduce estas fases a
> sprints con objetivos, historias, milestones y los ADRs a aprobar en cada uno.

---

## Fases

| Fase | Nombre | Objetivo | Estado |
|:----:|--------|----------|:------:|
| **0** | **Investigación** | Validar proveedores de datos, viabilidad legal, costes y cobertura. | 🟢 **En curso** |
| 1 | Arquitectura | Definir arquitectura global (Football Data Hub, servicios, límites). ADRs base. | ⬜ |
| 2 | Modelo de datos | Diseñar el dominio y el esquema de BD (jugadores, equipos, partidos, usuarios…). | ⬜ |
| 3 | Sincronización | Construir la ingesta y normalización proveedor → BD propia. | ⬜ |
| 4 | Backend | Lógica Fantasy base y API interna. | ⬜ |
| 5 | Frontend | Interfaz sobre el backend propio. | ⬜ |
| 6 | Mercado Fantasy | Mecánica de compra/venta y economía de jugadores. | ⬜ |
| 7 | Entrenadores | Mercado de entrenadores + algoritmo propio de puntuación. | ⬜ |
| 8 | Estadio | Sistema de progresión y modificadores pasivos. | ⬜ |
| 9 | Beta | Pruebas con usuarios reales. | ⬜ |
| 10 | Producción | Lanzamiento. | ⬜ |

## Foco actual: Fase 0 — Investigación

**Pregunta a responder:** ¿cuál es la mejor estrategia para obtener, de forma legal,
sostenible y asequible, los datos necesarios para múltiples ligas?

Datos objetivo: jugadores, entrenadores, lesiones, sanciones, alineaciones, sustituciones,
resultados, eventos, fotografías, calendario, estadísticas y cambios de entrenador.

El trabajo vive en [`research/`](../research/):
- [`research/APIs.md`](../research/APIs.md) — proveedores de API (API-Football, SportMonks, Football-Data, OpenLigaDB, Wikidata…).
- [`research/Scraping.md`](../research/Scraping.md) — fuentes vía scraping (Transfermarkt, FBref, Sofascore, Flashscore, Comuniazo).
- [`research/Legal.md`](../research/Legal.md) — legalidad, términos de uso, derechos de datos e imágenes.
- [`research/Costs.md`](../research/Costs.md) — costes y límites de cada opción.
- [`research/Competitors.md`](../research/Competitors.md) — análisis de Comunio, Biwenger, Futmondo.

**Salida de la Fase 0:** uno o varios ADRs que fijen la estrategia de datos y el/los
proveedor(es), habilitando el arranque de la Fase 1.

## Regla de transición entre fases

Una fase se considera cerrada cuando: (a) sus preguntas clave están respondidas, (b) las
decisiones están documentadas en ADRs, y (c) el resultado es coherente con
[`00_VISION.md`](00_VISION.md).
