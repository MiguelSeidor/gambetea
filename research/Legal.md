# Investigación — Legalidad

> Condiciona toda la estrategia de datos. **Investigado: 2026-07-27. No es asesoramiento
> jurídico** — señala riesgos a validar con un profesional antes de producción.
> Alimenta el **ADR-001**.

## Hallazgos clave

1. **Los proveedores de API no licencian la *publicación* de los datos.** Su ToS te da acceso
   técnico, pero la autorización para *redistribuir/publicar* datos oficiales es
   **responsabilidad del cliente**; puede requerir permisos de los titulares (ligas,
   federaciones). Aplica a **todos** los proveedores por igual.
2. **Nombres + estadísticas:** generalmente utilizables en productos Fantasy (hay
   jurisprudencia favorable, sobre todo en EE. UU.; en la UE hay que tener en cuenta el
   *derecho sui generis* de bases de datos). Zona razonablemente segura para nuestro caso.
3. **Fotos de jugadores, escudos, camisetas y nombres de club = RIESGO ALTO.** Derechos de
   imagen/personalidad + marca. Se defienden con agresividad. **Evitarlos.**
4. **Scraping:** legalmente ambiguo (ToS + CFAA/equivalentes). Solo como complemento puntual
   donde sea legal, **nunca** como fuente principal.

## Decisiones legales derivadas (van al ADR)

- ✅ **Usar** nombres + estadísticas vía proveedor, sobre **nuestro** modelo con IDs internos.
- ✅ **Evitar** fotos reales de jugadores/entrenadores, escudos, camisetas y logos → usar
  **arte generado/ilustrativo** (ya es principio de diseño, ver `../docs/03_DESIGN_PRINCIPLES.md`).
  Esto **esquiva el mayor riesgo legal** de un tirón.
- ✅ **RGPD:** aplica a los datos de **nuestros usuarios** (registro, email), no tanto a los
  datos deportivos. Consentimiento + política de privacidad antes de la beta pública.
- ⏳ **Antes de producción (M6):** revisión legal sobre si, según ligas/jurisdicción, hace
  falta licencia de datos comercial. **No bloquea** desarrollo ni beta cerrada.

## Pendiente

- Leer a fondo el **ToS concreto de API-Football** sobre uso comercial y redistribución antes
  de lanzar públicamente.
- Confirmar postura sobre nombres de clubes/competiciones (¿usarlos tal cual o mapear a
  nombres propios/neutros si hiciera falta?).

## Conclusión

La estrategia es **legalmente defendible para desarrollo y beta cerrada** siempre que:
(1) trabajemos sobre datos propios, (2) evitemos imágenes/marcas reales, (3) hagamos revisión
legal antes de producción. → **ADR-001**.
