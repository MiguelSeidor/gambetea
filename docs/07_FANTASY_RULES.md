# 07 — Reglas Fantasy: plantilla & alineación

> Fuente de verdad de las **reglas de juego** del motor Fantasy de jugadores (E4, Sprint 6).
> Son **parámetros de balance**, tuneables sin cambios de arquitectura: viven como constantes
> en [`apps/api/src/fantasy/fantasy.rules.ts`](../apps/api/src/fantasy/fantasy.rules.ts).
> Las decisiones de **puntuación** (ADR-008) y **economía/valoraciones** (ADR-009) se
> documentan aparte cuando lleguen (Sprints 7 y 8).

---

## Composición de la plantilla

> **Actualizado (ADR-011/012):** la plantilla **no tiene límite** (fichas que quieras, pagas
> salario por todas). Lo de abajo (2-5-5-3) es solo el **draft inicial**, no un tope. La
> alineación es **11 + 1 entrenador + 1 suplente**.

El **draft inicial** entrega 15 jugadores + 1 entrenador:

| Posición | Cantidad (draft) |
|----------|:--------:|
| Portero (GK)     | 2 |
| Defensa (DEF)    | 5 |
| Centrocampista (MID) | 5 |
| Delantero (FWD)  | 3 |
| Entrenador       | 1 |

A partir de ahí, compras/vendes sin límite en el mercado (inspiración Comunio/Biwenger/FPL, no
copia).

## Formaciones permitidas

Alineación = **11 titulares** (1 GK + 10 de campo) + **1 entrenador** + **1 suplente**. El
portero es siempre 1; la formación define el reparto de los 10 de campo:

| Formación | DEF | MID | FWD |
|-----------|:---:|:---:|:---:|
| 4-3-3 | 4 | 3 | 3 |
| 4-4-2 | 4 | 4 | 2 |
| 3-5-2 | 3 | 5 | 2 |
| 5-3-2 | 5 | 3 | 2 |
| 3-4-3 | 3 | 4 | 3 |
| 4-5-1 | 4 | 5 | 1 |
| 5-4-1 | 5 | 4 | 1 |

## Reglas de validación de la alineación

Una alineación es **válida** si y solo si:

1. Exactamente **11 titulares** y **0-1 suplentes**.
2. Los seleccionados pertenecen a la **plantilla** (el resto de la plantilla queda fuera; sin
   obligación de usarla toda).
3. Sin duplicados ni solapes entre titulares y suplente.
4. La formación está en la lista permitida.
5. El recuento por posición de los **titulares** coincide con la formación (siempre 1 GK).
6. El **capitán**, si se indica, es uno de los titulares.
7. El **entrenador**, si se indica, es uno de los del roster (solo ese puntúa; se congela en el
   snapshot).

El **orden de los suplentes** es su prioridad de entrada (sustituciones automáticas por lesión/
no-participación se resolverán en el motor de puntuación, Sprint 7).

## Ciclo de edición

- La alineación se guarda **por jornada** (`FantasyLineup` único por equipo + jornada).
- Solo se puede editar mientras la jornada está **`UPCOMING`** u **`OPEN`** (antes del cierre).
  Una jornada **`LOCKED`** o **`FINISHED`** no admite cambios.

## Asignación inicial (bootstrap — provisional)

> ⚠️ **Provisional hasta el Sprint 8 (mercado & economía, ADR-009).**

Al entrar a una liga, el equipo recibe una **plantilla auto-generada** (draft) de 15 jugadores
reales de la competición, respetando la composición por posición. En esta fase:

- El **precio de adquisición** es 0 (no hay valoraciones de jugadores todavía).
- El **presupuesto inicial** es un valor nominal (`INITIAL_BUDGET`), sin efecto real hasta
  que exista el mercado.

Cuando llegue el mercado (Sprint 8), la asignación inicial y el presupuesto se rediseñan con
**valoraciones reales** y deducción de saldo. El motor de alineación de este sprint no cambia.
