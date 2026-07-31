# Investigación — Costes y límites

> Coste y límites de las opciones de datos. **Investigado: 2026-07-27.** Verificar al contratar.
> Alimenta el **ADR-001**.

## Comparativa de precios (planes de entrada)

| Proveedor | Plan | Precio | Límite | Cobertura | Notas |
|-----------|------|--------|--------|-----------|-------|
| **API-Football** | Free | $0 | 100 req/día | Todas las ligas | Solo pruebas |
| **API-Football** | **Pro** | **$19/mes** | ~7.500 req/día | Todas | **Suficiente para MVP** |
| API-Football | Ultra | $29/mes | 75.000 req/día | Todas | Margen para crecer |
| API-Football | Mega | $39/mes | 150.000 req/día | Todas | Multi-liga a escala |
| SportMonks | Starter | ~€34/mes (anual) | por cupo | **5 ligas** | Calidad alta |
| SportMonks | Growth | €99/mes | por cupo | 30 ligas | Multi-liga real |
| Football-Data.org | Free | €0 | 10 req/min | 12 comp. | Sin datos de jugador |
| Football-Data.org | +add-ons | €70+/mes | — | 12+ | Apilando add-ons |

## Coste por escenario

- **MVP / Beta (1 liga):** **API-Football Pro $19/mes** cubre de sobra. Coste de datos ≈ **$19/mes**.
  Infra: Postgres + Redis + app en Railway (plan bajo) ≈ decenas de $/mes.
- **Crecimiento (varias ligas, miles de usuarios):** API-Football Ultra/Mega ($29–39/mes) —
  el precio **no** escala por nº de ligas (ventaja clave frente a SportMonks). Escala el coste
  de infra (workers de sync, caché, BD), no el de datos.
- **Objetivo (multi-liga amplio):** seguimos con API-Football (todas las ligas incluidas) o
  evaluamos SportMonks Enterprise si necesitamos calidad/ xG. Coste de datos previsible.

## Nota estratégica

El modelo de **API-Football (todas las ligas en cualquier plan)** es más amigable para
multi-liga que el de **SportMonks (pago por nº de ligas)**. Con el patrón Data Hub, el coste
que escala es el de **infraestructura de sincronización**, no el de la licencia de datos.

## Conclusión

**Desarrollo y testing a coste €0** usando un proveedor `mock` propio (seed + simulador);
el único gasto fijo es Railway (ya disponible). El coste de datos reales (**~$19/mes con
API-Football**) se **difiere al lanzamiento al mercado**, cuando aporta valor. → **ADR-001**.
