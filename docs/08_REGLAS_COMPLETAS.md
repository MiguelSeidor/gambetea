# 08 — Reglas completas del juego (todas las casuísticas)

> Fuente de verdad **jugable** de Gambetea: explica **todo** lo que ocurre y **cuándo**, con
> los casos borde. Los parámetros numéricos son **tuneables** (viven en `*.rules.ts` /
> `economy.rules.ts`). Las decisiones de arquitectura están en los ADR (001-012).

---

## 1. Cuenta, ligas y equipo

- Te **registras** (email + contraseña) y creas o te unes a una **liga privada** con un código
  de invitación de 6 caracteres.
- Al entrar a una liga recibes un **equipo Fantasy** con un **draft inicial**: 15 jugadores
  (2 GK, 5 DEF, 5 MID, 3 FWD) **+ 1 entrenador**, y un **presupuesto** = 150M € menos el valor
  de lo drafteado.
- Puedes estar en **varias ligas**; cada una tiene su propio equipo, saldo y clasificación.

## 2. Plantilla (sin límite)

- **No hay límite** de jugadores ni de entrenadores. Puedes tener tantas fichas como quieras.
- **Contrapeso:** pagas **salario** por **cada** ficha (ver §7).
- El **valor** de cada jugador/entrenador se recalcula tras cada jornada (ver §6).

## 3. Alineación

- **11 titulares**; la **formación/táctica** elegida define las posiciones. Formaciones:
  4-3-3, 4-4-2, 3-5-2, 5-3-2, 3-4-3, 4-5-1, 5-4-1 (siempre 1 portero).
- **+ 1 entrenador** elegido (de los de tu plantilla). **Solo ese entrenador puntúa**.
- **+ 1 suplente** (banquillo). *(Más huecos, quizá, en una futura cuenta premium.)*
- **Capitán** (opcional): un titular; **dobla** sus puntos.
- La alineación se puede **editar** mientras la jornada no haya terminado, **pero lo que cuenta
  es el snapshot** (ver §4).
- **Validación:** exactamente 11 titulares que cuadren con la formación; 0-1 suplente; el
  entrenador y el capitán, si se indican, deben ser de tu plantilla / de tus titulares.

## 4. Ciclo temporal de una jornada (ADR-010)

Tres momentos, en la **zona horaria de la competición** (LaLiga: Madrid):

1. **Snapshot — 30 min antes del primer partido.** Se **congela** una copia de tu alineación
   (11 + entrenador + suplente) **y de tu caja** (saldo). Es lo que puntuará. Puedes seguir
   editando después, pero esta jornada ya cuenta con lo fotografiado.
2. **Puntos y primas — 30 min después del último partido.** Se calculan los puntos y se
   reparte el dinero por puntos.
3. **Mercado, valores, salarios y cuotas — 00:00.** Se resuelven pujas, se revalorizan activos,
   rota el mercado y se cobran salarios/seguro/préstamos (los salarios y cargas solo los **días
   que hay jornada**).

> **Casuística — partidos aplazados:** se crea una **jornada Virtual** que contabiliza solo ese
> partido cuando se juegue. *(Diseñado; se activa con el proveedor real — el mock no aplaza.)*

## 5. Puntuación

### 5.1 Jugadores (ADR-008) — desde eventos reales
| Concepto | GK | DEF | MID | FWD |
|---|:--:|:--:|:--:|:--:|
| Jugar 1-59 min | +1 | +1 | +1 | +1 |
| Jugar ≥60 min | +2 | +2 | +2 | +2 |
| Gol | +6 | +6 | +5 | +4 |
| Asistencia | +3 | +3 | +3 | +3 |
| Portería a cero (≥60 min) | +4 | +4 | +1 | 0 |
| Cada 2 goles encajados (jugando) | −1 | −1 | — | — |
| Tarjeta amarilla | −1 | −1 | −1 | −1 |
| Tarjeta roja | −3 | −3 | −3 | −3 |
| Gol en propia / penalti fallado | −2 | −2 | −2 | −2 |
| Penalti parado | +5 | — | — | — |

- **Capitán:** ×2 (si jugó).
- **Sustitución automática:** un titular que **no jugó** (0 min) entra por el **suplente** si es
  de su **misma posición** y sí jugó.
- **Casuística — lesión durante el partido:** el jugador **conserva los puntos de su tiempo
  jugado** (minutos + eventos) **y** suma lo de su seguro (ver §8).

### 5.2 Entrenadores (ADR-011) — desde el partido de su equipo
Victoria +10 · Empate +4 · Derrota −4 · +1 por gol a favor · −1 por gol en contra · portería a
cero +4 · goleada (≥3) +3 · vapuleo (≥3) −3 · victoria a domicilio +3 · derrota como local −3.
Solo puntúa el **entrenador elegido** en el snapshot.

### 5.3 Total del equipo
Suma de los **titulares efectivos** (tras auto-sustitución) + capitán (×2) + **entrenador
elegido** + **bonus de seguros** aplicables. Este total:
- **Cuenta para la clasificación** solo si el equipo **no estaba en números rojos** en el
  snapshot (ver §9).
- **Genera dinero** (prima) **siempre** (ver §6), aunque el equipo esté en rojo.

## 6. Economía: valores y primas (ADR-009/010)

- **Valor de jugador** = base por posición (GK 2M · DEF 3M · MID 4M · FWD 5M) + puntos_temporada
  × 200.000 €. **Valor de entrenador** = 4M + puntos_temporada × 120.000 €. Mínimo 500.000 €.
- **Prima por puntos:** cada punto de jornada = **20.000 €**, pagados a **todos** los equipos
  (incluso en rojo); puntos negativos → 0 €.
- Todo movimiento deja una **transacción** con importe con signo (auditable).

## 7. Salarios — el sumidero (ADR-012)

- **Cada jornada** pagas **1% del valor** de **cada** ficha (jugadores + entrenadores).
- Se cobra a las **00:00 del día en que hay jornada** (una vez por jornada).
- **Puede dejarte en rojo** (plantilla ancha/cara sin rendimiento → salarios > primas).
- **Filosofía:** buena gestión → superávit; mala gestión → déficit.

## 8. Seguro médico (ADR-012)

- **Individual por jugador**, tres niveles: **Básico** (+1, 10.000 €/año) · **Medio**
  (+3, 20.000 €/año) · **Avanzado** (+5, 30.000 €/año).
- **Efecto:** si el jugador **está alineado (titular)** y **se lesiona** en la jornada, su
  equipo suma el **bonus** del nivel (además de los puntos que hiciera).
- **Coste:** prorrateado por jornada (coste_año / 38), cobrado a las 00:00 con los salarios.
- **Contractual con el equipo:** si **vendes o pierdes** al jugador (venta, cláusula), el
  seguro **se pierde**. Si **fichas** a un jugador que tenía seguro, **no lo heredas** (lo
  pierde).

## 9. Números rojos (ADR-010)

- Se llega gastando **más de lo disponible**: fichajes por encima del saldo, o salarios/seguro/
  cuotas de préstamo mayores que tu caja.
- Un equipo en **números rojos** (caja negativa en el snapshot):
  - **NO suma** a la clasificación esa jornada.
  - **SÍ genera** el dinero que le toque (prima por sus puntos).
- **No puedes iniciar un fichaje** (puja/cláusula) estando ya en rojo; sales del rojo con
  primas, ventas y préstamos.

## 10. Mercado (ADR-009/012)

- **Tabla única** con **jugadores y entrenadores**. Siempre hay **≥2 entrenadores**; la tanda
  de agentes libres **rota cada día** (00:00).
- **Subasta ciega:** pujas por un agente libre (≥ precio de salida). Al resolver (00:00) gana
  la **más alta**; **empate → la primera** en hacerse. Se carga **aunque quedes en rojo** (sin
  límite de plantilla).
- **Venta al banco:** vendes un jugador tuyo a su **valor** actual (no puedes bajar de 11).
- **Cláusula de rescisión:** pagas **valor × 2** para llevarte al jugador de otro mánager (el
  dinero va al vendedor).
- Los jugadores que un mánager **pone a la venta** aparecen **al instante** (no esperan al 00:00).

## 11. Préstamos (ADR-012)

- Hasta **3 préstamos activos** por equipo, del banco.
- **Importe máximo** por préstamo = **50% de tu patrimonio** (saldo + valor de plantilla).
- **Amortización francesa** (cuota constante) al **5% TAE**: se paga **una cuota por jornada**
  hasta el **fin de temporada** (nº de cuotas = jornadas que quedaban al pedirlo), cobrada a las
  00:00 con las demás cargas.
- El principal entra a tu caja al instante; cada cuota = interés + amortización de principal.

## 12. Resumen de "quién cobra/paga y cuándo"

| Momento | Qué pasa |
|---|---|
| **T − 30 min** (1er partido) | Snapshot de alineación + caja. |
| **Último partido + 30 min** | Puntos de jugadores/entrenadores + **primas** (a todos). |
| **00:00 (día de jornada)** | **Salarios** + **seguro** (prorrateo) + **cuota de préstamo**. |
| **00:00 (cada día)** | Resolver **pujas**, **revalorizar**, **rotar** agentes libres (+≥2 DT). |

---

> Documentos relacionados: [`07_FANTASY_RULES.md`](07_FANTASY_RULES.md) (plantilla/alineación),
> ADR-008 a ADR-012. Cuando lleguen **estadio** (ADR-013) y **jornadas virtuales** reales, se
> añaden aquí sus casuísticas.
