// Genera las 14 imágenes del estadio (un nivel por mejora) con OpenAI (gpt-image-1)
// → public/brand/stadium/level-0.webp … level-13.webp
//
// Uso:  cd apps/web && node --env-file=.env scripts/generate-stadium-images.mjs
// Requiere OPENAI_API_KEY en apps/web/.env. Node 18+ (fetch global).

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("Falta OPENAI_API_KEY. Crea apps/web/.env con OPENAI_API_KEY=...");
  process.exit(1);
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "brand", "stadium");

const STYLE =
  "cinematic dark moody premium editorial sports architecture photography at night, low-key lighting, " +
  "deep shadows, warm orange rim light (#FF6A2C) and cool electric indigo-blue haze (#4726FF), high contrast, " +
  "film grain, wide angle, no text, no logos, no watermark, no brand marks";

// Cada nivel describe el estadio un poco más grande/mejorado que el anterior.
const LEVELS = [
  "a small modest football stadium at night, single tier stands, dim floodlights, empty green pitch",
  "a football stadium with a slightly larger lower tier, brighter floodlights beginning to glow",
  "a growing football stadium, fuller stands, warm lights spilling onto the pitch",
  "a mid-size football stadium, two tiers of stands, strong floodlights, atmospheric haze",
  "a larger football stadium with a partial roof over the stands, dramatic lighting",
  "a big modern football stadium, full roof ring, bright uniform floodlights, glowing pitch",
  "an impressive modern stadium, sweeping curved roof, powerful lighting, epic scale",
  "a grand stadium with a translucent illuminated facade glowing warm orange at night",
  "a colossal stadium, vast illuminated exterior, dramatic architectural lighting, monumental",
  "a colossal stadium with a pristine perfectly striped green hybrid pitch, immaculate turf glowing",
  "a colossal stadium with wide grand illuminated entrance concourses and access ramps",
  "a colossal stadium with brilliant powerful stadium floodlight towers blazing into the night sky",
  "a colossal stadium with a huge glowing LED scoreboard/screen lighting the stands",
  "a colossal futuristic stadium with a large illuminated parking esplanade and full night ambience, ultimate final form",
];

async function gen(level, scene) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${scene}. ${STYLE}`,
      n: 1,
      size: "1536x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 70,
    }),
  });
  if (!res.ok) throw new Error(`level ${level}: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  const buf = Buffer.from(data.data[0].b64_json, "base64");
  await writeFile(join(OUT, `level-${level}.webp`), buf);
  console.log(`OK  level-${level}  ${Math.round(buf.length / 1024)} KB`);
}

await mkdir(OUT, { recursive: true });
for (let i = 0; i < LEVELS.length; i++) {
  try {
    await gen(i, LEVELS[i]);
  } catch (e) {
    console.error("ERR", e.message);
  }
}
