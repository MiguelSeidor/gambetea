# Investigación — Proveedores de API

> Objetivo: evaluar APIs de datos de fútbol para alimentar el **Football Data Hub**.
> **Investigado: 2026-07-27.** Los precios/coberturas cambian — verificar al contratar.
> De aquí sale el **ADR-001** (proveedor de datos).

## Criterios de evaluación

Cobertura de ligas · datos disponibles (jugadores, entrenadores, lesiones, sanciones,
alineaciones, sustituciones, resultados, eventos, calendario, estadísticas, cambios de
entrenador) · frescura/latencia · límites · coste · legalidad · calidad · mantenimiento ·
facilidad de mapeo a nuestro modelo.

---

## Proveedores

### API-Football — api-sports.io / api-football.com  ⭐ candidato principal
- **Cobertura:** 1.236 ligas; todas las competiciones en cualquier plan de pago.
- **Datos:** fixtures, **alineaciones**, **sustituciones**, **eventos** en vivo (actualización ~15s),
  standings, **stats de jugador**, **lesiones**, **entrenadores**, **traspasos**, predicciones, cuotas.
- **Límites/precio:** Free 100 req/día · Pro **$19/mes** (~7.500 req/día) · Ultra $29 (75k/día) ·
  Mega $39 (150k/día). Todos los endpoints en todos los planes de pago.
- **Pros:** mejor relación cobertura/precio; cubre **todo** lo que necesita el motor Fantasy,
  incluidos **entrenadores** (pilar diferencial); arranque barato; buena documentación.
- **Contras:** calidad algo por debajo de proveedores premium; sin xG en tiers básicos;
  empresa no-UE (verificar términos de uso comercial y redistribución).
- Fuentes: [pricing](https://www.api-football.com/pricing) · [docs](https://api-sports.io/documentation/football/v3) · [terms](https://www.api-football.com/terms)

### SportMonks — sportmonks.com  ⭐ alternativa fuerte / upgrade
- **Cobertura:** 2.200+ ligas (la mayor). Planes por **nº de ligas elegidas**.
- **Datos:** livescores, alineaciones, **xG**, **expected lineups**, formaciones, squads,
  perfiles de jugador, standings en vivo, coordenadas de balón, cuotas, predicciones.
- **Límites/precio:** Starter ~€34/mes (5 ligas, facturación anual) · Growth €99/mes (30 ligas) ·
  Pro (120 ligas) · Enterprise (2.200+). Mismos datos en todos los planes; cambia nº de ligas y cupo.
- **Pros:** calidad de datos alta; **empresa europea** (NL) → más cómodo para RGPD/legal;
  buen camino de upgrade si necesitamos xG/expected lineups.
- **Contras:** más caro; el modelo "por nº de ligas" limita multi-liga hasta planes altos.
- Fuentes: [plans](https://www.sportmonks.com/football-api/plans-pricing/) · [football-api](https://www.sportmonks.com/football-api/)

### Football-Data.org  — fallback barato / prototipado
- **Cobertura:** 12 competiciones en Free (grandes ligas europeas).
- **Datos:** tablas, fixtures, calendario; marcadores **retrasados** en Free. **Sin datos de
  jugador** (alineaciones, cambios, tarjetas) en Free. Add-ons apilables (livescores €12,
  deep data €29, stats €15, odds €15) → €70+/mes.
- **Límites:** 10 req/min en Free.
- **Veredicto:** genial para aprender/prototipar y como **fuente secundaria** de fixtures/standings
  (redundancia), pero **insuficiente como fuente única** para un Fantasy.
- Fuente: [pricing](https://www.football-data.org/pricing)

### Enterprise (Opta/Stats Perform, Sportradar) — fuera de alcance ahora
- Datos oficiales licenciados, máxima calidad, pero **contratos enterprise caros**. Reservar
  para escala/producción si hiciera falta dato oficial licenciado. No para bootstrapping.

### OpenLigaDB / Wikidata — nicho
- OpenLigaDB: foco Bundesliga (gratis) — posible complemento puntual. Wikidata: metadatos de
  entidades, no eventos en vivo. No son base de la estrategia.

---

## Comparativa

| Proveedor | Ligas | Datos clave para Fantasy | Entrenadores | Precio entrada | Veredicto |
|-----------|:----:|---------------------------|:----:|-----|-----------|
| **API-Football** | 1.236 | Alineaciones, subs, eventos, lesiones, stats, traspasos | ✅ | **$19/mes** | **Principal** |
| **SportMonks** | 2.200+ | + xG, expected lineups, coordenadas | ✅ | ~€34–99/mes | Alternativa/upgrade |
| Football-Data.org | 12 (free) | Fixtures/standings; sin datos de jugador en free | ❌ | Free / €70+ | Fallback/proto |

## Conclusión

**Enfoque por fases** (presupuesto de desarrollo €0):
- **Durante el desarrollo/testing:** proveedor **`mock`** propio y gratuito (seed realista +
  simulador), como primer adaptador del Data Hub.
- **Al salir al mercado:** **API-Football** como proveedor de datos reales (mejor
  cobertura/precio, incluye entrenadores), enchufado como otro adaptador **sin tocar el resto**.

**SportMonks** queda como alternativa/upgrade documentada; **Football-Data.org** como posible
redundancia de fixtures y fuente gratuita de sembrado. → formalizado en **ADR-001**.
