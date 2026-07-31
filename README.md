# Fantasy Football — Proyecto

Plataforma de Fantasy Football de nueva generación. Inspirada en el Fantasy clásico
(Comunio, Biwenger, Futmondo) pero con mecánicas propias: **jugadores**, **entrenadores**
y **estadio propio**.

> **Estado actual: FASE 0 — Investigación.** Todavía no se desarrolla producto.
> Ver [`docs/02_ROADMAP.md`](docs/02_ROADMAP.md).

## Cómo está organizado este repositorio

| Ruta | Contenido |
|------|-----------|
| [`CLAUDE.md`](CLAUDE.md) | Reglas operativas y comportamiento del asistente (CTO). Se carga en cada sesión. |
| [`docs/00_VISION.md`](docs/00_VISION.md) | La constitución: qué es y qué NO es, filosofía, restricciones. |
| [`docs/01_TECH_STACK.md`](docs/01_TECH_STACK.md) | Stack tecnológico (tentativo, pendiente de validar). |
| [`docs/02_ROADMAP.md`](docs/02_ROADMAP.md) | Fases del proyecto (0 → 10). |
| [`docs/03_DESIGN_PRINCIPLES.md`](docs/03_DESIGN_PRINCIPLES.md) | Listón de diseño: premium, nivel agencia. Imágenes generadas con OpenAI. |
| [`docs/05_BACKLOG.md`](docs/05_BACKLOG.md) | **Backlog por sprints** del proyecto completo (investigación → producción). |
| [`adr/`](adr/) | Architecture Decision Records: cada decisión importante, justificada. |
| [`research/`](research/) | Investigación en curso: APIs, scraping, legal, costes, competidores. |
| [`brand/`](brand/) | Assets de marca: logo (`crest.svg`), favicon, imágenes de la landing. |
| [`web/`](web/) | Landing en **Next.js** (App Router). Ver [`web/README.md`](web/README.md). |

## Filosofía en una frase

> Nunca dependemos directamente de un proveedor externo. Todo dato se sincroniza a nuestra
> base de datos propia (**Football Data Hub**), y la aplicación trabaja siempre sobre datos
> propios con IDs internos.

## Principio rector

La calidad de la arquitectura está por encima de la velocidad de desarrollo. Nada importante
se implementa sin un ADR aprobado y un modelo de datos definido.
