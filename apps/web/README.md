# Gambetea — Web

Landing y (futura) aplicación web de **Gambetea**. Next.js 16 (App Router) · React 19 ·
TypeScript · Tailwind v4.

> Estética y contenido salen del sistema de marca del proyecto — ver
> [`../docs/04_BRAND.md`](../docs/04_BRAND.md) y [`../docs/03_DESIGN_PRINCIPLES.md`](../docs/03_DESIGN_PRINCIPLES.md).

## Desarrollo

```bash
npm install       # solo la primera vez
npm run dev       # http://localhost:3000
npm run build     # build de producción
npm start         # sirve el build
```

## Estructura

```
src/
  app/
    layout.tsx        # metadata, fuentes (Geist), <html lang="es">
    page.tsx          # la landing (server component)
    globals.css       # sistema de diseño dark + estilos de la landing
    icon.svg          # favicon (convención de Next)
  components/
    Interactions.tsx  # "use client": reveals, parallax al scroll, formularios
public/
  brand/              # imágenes (hero, pilares) + crest.svg/webp, favicon.svg
scripts/
  generate-images.mjs # regenera las imágenes con OpenAI (gpt-image-1)
```

## Regenerar las imágenes (OpenAI)

Las fotos de la landing se generan con OpenAI. La clave va en `.env` (nunca en git).

```bash
cp .env.example .env          # y pon tu OPENAI_API_KEY
node --env-file=.env scripts/generate-images.mjs
```

Genera `public/brand/{hero,jugadores,entrenadores,estadio}.webp`.

## Pendiente

- **Formularios de early access**: hoy son solo cliente (prototipo). Falta conectar a un
  backend/lista real cuando exista.
- **Capturas de la app** (alineación, estadio) — ver backlog en
  [`../docs/03_DESIGN_PRINCIPLES.md`](../docs/03_DESIGN_PRINCIPLES.md).
- La estructura de repo (monorepo, backend Nest, etc.) es una decisión de **Fase 1**
  pendiente de ADR. Por ahora `web/` vive suelto en la raíz.
