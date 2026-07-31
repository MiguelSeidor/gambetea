// Regenera los assets de imagen de la landing con OpenAI (gpt-image-1) → public/brand/*.webp
//
// Uso:  cd web && node --env-file=.env scripts/generate-images.mjs
// Requiere OPENAI_API_KEY en .env (ver .env.example). Node 18+ (fetch global).

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("Falta OPENAI_API_KEY. Crea web/.env a partir de .env.example.");
  process.exit(1);
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "brand");

const STYLE =
  "cinematic dark moody premium editorial sports photography, low-key lighting, deep shadows, " +
  "warm orange rim light (#FF6A2C) and cool electric indigo-blue haze (#4726FF), high contrast, " +
  "film grain, shallow depth of field, night, no text, no logos, no watermark, no brand marks";

const JOBS = [
  ["hero", "1536x1024", "high",
    "Wide cinematic shot of a footballer mid-dribble at night under bright stadium floodlights, dynamic action, motion blur on the legs and the ball, dramatic backlight, atmospheric haze. " + STYLE],
  ["jugadores", "1024x1024", "medium",
    "Extreme dramatic close-up of a football boot striking a wet ball on floodlit grass at night, water droplets flying, sharp focus on the ball. " + STYLE],
  ["entrenadores", "1024x1024", "medium",
    "Silhouette of a football coach standing on the touchline at night seen from behind, hands in pockets, blurred glowing stadium and crowd behind, strong backlight. " + STYLE],
  ["estadio", "1024x1024", "medium",
    "A grand empty modern football stadium at night, glowing green pitch, dramatic architectural lighting, vast atmospheric wide angle, cinematic scale. " + STYLE],
];

async function gen([name, size, quality, prompt]) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality,
      output_format: "webp",
      output_compression: 68,
    }),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  const buf = Buffer.from(data.data[0].b64_json, "base64");
  await writeFile(join(OUT, `${name}.webp`), buf);
  console.log(`OK  ${name.padEnd(12)} ${Math.round(buf.length / 1024)} KB`);
}

await mkdir(OUT, { recursive: true });
for (const job of JOBS) {
  try {
    await gen(job);
  } catch (e) {
    console.error("ERR", e.message);
  }
}
