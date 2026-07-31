# Investigación — Scraping

> Fuentes cuyos datos podrían obtenerse mediante scraping cuando no haya API adecuada.
> ⚠️ El scraping tiene implicaciones **legales**, de **estabilidad** y de **mantenimiento**.
> Cruzar siempre con `Legal.md`. El scraping es un recurso, no la estrategia por defecto.

## Criterios específicos del scraping

- **Legalidad / términos de uso** de la fuente (crítico — ver `Legal.md`)
- **Fragilidad** (¿cambia mucho el HTML? ¿protecciones anti-bot?)
- **Coste de mantenimiento** (los scrapers se rompen)
- **Frescura** de los datos
- **Riesgo de bloqueo** (rate limiting, IP bans, captchas)
- **Calidad / estructura** de los datos extraídos

## Fuentes a investigar

### Transfermarkt
- Datos potenciales: valores de mercado, plantillas, traspasos, lesiones, sanciones.
- _por investigar_

### FBref
- Datos potenciales: estadísticas avanzadas.
- _por investigar_

### Sofascore
- Datos potenciales: eventos en vivo, ratings, alineaciones.
- _por investigar_ (nota: fuerte protección anti-bot, probable)

### Flashscore
- Datos potenciales: resultados y eventos en vivo.
- _por investigar_

### Comuniazo
- Datos potenciales: puntuaciones/valores estilo Comunio.
- _por investigar_

## Comparativa (rellenar al final)

| Fuente | Datos clave | Legalidad | Fragilidad | Mantenimiento | Veredicto |
|--------|-------------|-----------|------------|---------------|-----------|
| | | | | | |

## Conclusión provisional

_Pendiente. El scraping solo se adoptará donde no haya alternativa vía API y la legalidad
lo permita._
