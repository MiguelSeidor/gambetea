# 04 — Marca (Brand)

> Identidad de marca del proyecto. Marca de trabajo: **Gambetea**. El nombre es
> deliberadamente un **valor único y reemplazable** (ver sección 6): cambiarlo no debe
> costar más que un find & replace. La *due diligence* de dominio/registro queda pendiente.

---

## 1. Nombre

**Gambetea** — acuñación sobre el verbo *gambetear* (regatear, driblar). *"¡Gambetea!"* es
una llamada a la acción: **juega distinto, regatéalos**. Conserva el alma callejera de
"gambeta" pero, al ser una forma verbal propia, es mucho más *ownable* (namespace limpio,
registrable) que los términos genéricos del fútbol (gambeta, tiki-taka…), que ya están
ocupados en la categoría de apps deportivas.

- Pendiente: verificar disponibilidad de dominio y viabilidad de registro de marca.

## 2. Esencia y tono

- **Esencia:** la gambeta. Regate, calle, audacia, flair, ganar con estilo, "jugá distinto".
- **Tono:** confiado, pícaro, enérgico, premium-callejero. Frases cortas y con actitud.
  Español natural (no neutro acartonado).
- **Promesa:** la simplicidad del Fantasy clásico + la audacia de mecánicas nuevas
  (entrenadores y estadio). Fácil de jugar, difícil de soltar.

## 3. Paleta

Neutros cálidos elegidos (sesgo hacia el acento), no grises inertes. Dos acentos que
trabajan **juntos** (calor vs. frío) en lugar de un único "pop".

| Rol | Light | Dark |
|-----|-------|------|
| Fondo | `#ECE6D8` (tiza/hueso cálido) | `#100E17` (aubergine-tinta) |
| Superficie | `#F5F1E7` | `#191622` |
| Tinta / texto | `#1A1611` | `#F3EEE3` |
| Apagado (muted) | `#6B6357` | `#9A93A6` |
| Acento 1 — "gol" | `#FF5A1F` (naranja) | `#FF6A33` |
| Acento 2 — "flair" | `#4726FF` (índigo eléctrico) | `#7B5CFF` |

## 4. Tipografía

- **Display:** sans pesada, tratada de forma **cinética** — mayúsculas, tracking negativo,
  ligera compresión horizontal e itálica para sugerir el gesto del regate.
- **Body:** sans limpia y legible (~65 caracteres de ancho).
- **Utility / datos:** **monoespaciada** para etiquetas, kickers y cifras — la voz
  "marcador/estadística" del fútbol. Es un rasgo distintivo de la marca.

> En la comp actual se usan *system font stacks* (la CSP de la preview bloquea webfonts).
> En el build real (Next.js) se licenciará una **display face condensada** propia.

## 5. Movimiento

- Rápido, evasivo, "de una". La firma es el **regate**: en el héroe, un balón traza un
  slalom dejando estela. Un único momento orquestado; el resto de la página, tranquilo.
- Respetar siempre `prefers-reduced-motion`.

## 6. El nombre como configuración

En el código, el nombre de marca vive en **un solo lugar** (constante / token). Ninguna
parte del producto debe hardcodear "Gambetea" de forma dispersa. Rebrandear = cambiar un
valor.

## 7. Logotipo, wordmark y favicon (decidido)

- **Wordmark:** **"GAMBETEA" en mayúsculas**, tipográfico (no IA), en cursiva cinética con
  compresión horizontal y degradado naranja→índigo. Motivo: la IA no rinde texto fiable
  (llegó a escribir "GAMBETA"); el wordmark tipográfico da ortografía perfecta, es escalable
  y editable.
- **Logo-símbolo:** **escudo con un jugador en pleno regate** (silueta oscura sobre escudo
  naranja). Representa literalmente el nombre y aporta aire de club. Generado con IA,
  recortado a fondo transparente y **revectorizado a SVG** (`brand/crest.svg`, ~10 KB, 2
  colores planos, escalable a cualquier tamaño).
- **Favicon:** **"G" cursiva** sobre cuadrado oscuro redondeado, en **SVG vectorial**
  (`brand/favicon.svg`). Nítido a 16px.
- **Lockup:** escudo + wordmark en horizontal (ver nav/footer de la landing).

## 8. Assets del proyecto

Guardados en [`../brand/`](../brand/):
- `favicon.svg` — favicon vectorial.
- `crest.svg` — **logo-símbolo vectorial** (asset maestro, escalable).
- `crest.png` / `crest.webp` — escudo rasterizado con fondo transparente (para web ligera).
- `hero.webp`, `jugadores.webp`, `entrenadores.webp`, `estadio.webp` — imágenes de la landing.

Las imágenes fotográficas se generan con **OpenAI** (`gpt-image-1`, ver
[`03_DESIGN_PRINCIPLES.md`](03_DESIGN_PRINCIPLES.md)), estilo cinematográfico nocturno
coherente con esta paleta. **La API key nunca se guarda en el repo** — va en `.env`
(en `.gitignore`).
