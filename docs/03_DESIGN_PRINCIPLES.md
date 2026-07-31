# 03 — Principios de diseño (Design Bar)

> El nivel visual del producto es un **requisito de primera clase**, no un adorno final.
> Este documento fija el listón de calidad. Cualquier interfaz que construyamos debe
> cumplirlo. Aplica especialmente a la cara pública del producto (landing) y se extiende a
> toda la aplicación.

---

## 1. El listón (no negociable)

- **Producto premium.** Debe **parecer una web de 30.000 €**, no una plantilla.
- **Diseño de agencia, no de plantilla.** Nada de layouts genéricos, componentes por
  defecto sin trabajar ni "bootstrap look". Cada pantalla se compone, no se rellena.
- **Composiciones, no cuadrículas planas.** Jerarquía visual fuerte, uso intencionado del
  espacio, tipografía con carácter, capas y profundidad.
- **Movimiento con propósito.** Animaciones, transiciones y micro-interacciones cuidadas
  que aporten sensación de calidad; nunca gratuitas ni que penalicen el rendimiento.
- **Responsive de serie (mobile-first).** Toda la interfaz —landing y app— debe verse y
  funcionar **perfecta en móvil**, no solo en escritorio. Se diseña y prueba en móvil como
  requisito, no como adaptación posterior.

## 2. La landing

Primer entregable de imagen de marca. Requisitos:

- **Hero potente.** Impacto inmediato: titular fuerte, composición memorable, un efecto
  visual que enganche en el primer segundo.
- Secciones que expliquen los **tres pilares** (jugadores, entrenadores, estadio) con una
  narrativa visual, no como lista de features.
- Animaciones on-scroll, parallax/profundidad donde aporte, y transiciones fluidas.
- **Rendimiento**: la espectacularidad no puede cargarse el performance ni la
  accesibilidad. 60fps, buen LCP, respeto por `prefers-reduced-motion`.

## 3. Imágenes / assets visuales

- **Las imágenes de la web se generan con OpenAI** (generación de imágenes). Es la vía
  oficial de assets visuales del proyecto.
- Implica: definir un **estilo visual coherente** (prompts consistentes, paleta, tono) para
  que todo el material generado parezca de la misma marca.
- Cuidado con derechos de imagen de jugadores reales (cruzar con
  [`../research/Legal.md`](../research/Legal.md)): el arte generado con OpenAI ayuda a evitar
  ese problema para elementos ilustrativos/ambientales.

## 4. Cómo encaja con el stack

El stack elegido ya soporta este listón:
- **Next.js + React** para la landing y la app.
- **Tailwind + shadcn/ui** como base, **trabajada y personalizada** — shadcn es el punto de
  partida de los componentes, no el aspecto final.
- Librería de animación a decidir vía ADR cuando lleguemos a la Fase de frontend
  (candidatas: Framer Motion / GSAP). No se fija aún.

## 5. Relación con el roadmap

La app sigue en **Fase 0 (Investigación)**. La landing es marketing y está relativamente
**desacoplada** de la arquitectura de datos, por lo que **puede construirse antes** que el
resto del frontend si se decide así — sería la excepción justificada a la regla de "no
código todavía", porque no depende del Football Data Hub.

> Decisión de sequencing pendiente de confirmar con el propietario del proyecto.

## 6. Backlog de la landing

Ideas/pendientes acordados para la landing (a incorporar cuando toque):

- **Capturas de la app en funcionamiento.** Mostrar imágenes de la propia aplicación en uso
  — como mínimo una **pantalla de alineación** (el 11 del usuario) y una **pantalla de
  estadio** — para que se vea el producto real, no solo fotografía ambiental. Como la app
  aún no existe, serán **mockups de UI diseñados** (no fotos): maquetas realistas de esas
  dos vistas, coherentes con la paleta y el tono de marca. Pendiente de crear.
