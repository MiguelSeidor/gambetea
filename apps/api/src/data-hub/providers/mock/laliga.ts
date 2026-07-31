// Datos base y utilidades para el proveedor `mock` (LaLiga). Determinista por diseño
// (mismo seed → mismos datos) para que el backfill sea idempotente y los tests reproducibles.

export const SEASON = "2025/26";

export const TEAMS: { name: string; short: string }[] = [
  { name: "Real Madrid", short: "RMA" },
  { name: "Barcelona", short: "BAR" },
  { name: "Atlético de Madrid", short: "ATM" },
  { name: "Athletic Club", short: "ATH" },
  { name: "Real Sociedad", short: "RSO" },
  { name: "Real Betis", short: "BET" },
  { name: "Villarreal", short: "VIL" },
  { name: "Valencia", short: "VAL" },
  { name: "Sevilla", short: "SEV" },
  { name: "Girona", short: "GIR" },
  { name: "Osasuna", short: "OSA" },
  { name: "Celta de Vigo", short: "CEL" },
  { name: "Rayo Vallecano", short: "RAY" },
  { name: "Getafe", short: "GET" },
  { name: "Mallorca", short: "MLL" },
  { name: "Alavés", short: "ALA" },
  { name: "Las Palmas", short: "LPA" },
  { name: "Espanyol", short: "ESP" },
  { name: "Leganés", short: "LEG" },
  { name: "Valladolid", short: "VLL" },
];

export const FIRST_NAMES = [
  "Alejandro", "Pablo", "Diego", "Mario", "Sergio", "Álvaro", "Iker", "Marcos", "Adrián",
  "Javier", "Rubén", "Carlos", "Hugo", "Dani", "Nico", "Íñigo", "Unai", "Fran", "Gonzalo",
  "Marc", "Aitor", "Bruno", "Rodri", "Óscar", "Jorge", "Raúl", "Aleix", "Yeray", "Borja", "Samu",
];

export const SURNAMES = [
  "García", "Martínez", "López", "Sánchez", "Fernández", "Gómez", "Ruiz", "Torres", "Navarro",
  "Domínguez", "Vázquez", "Ramos", "Gil", "Serrano", "Molina", "Castro", "Ortega", "Rubio",
  "Marín", "Iglesias", "Medina", "Cortés", "Santos", "Herrera", "Peña", "Cabrera", "Vidal",
  "Reyes", "Campos", "Vega", "Fuentes", "Carmona", "Soler", "Prieto", "Méndez", "Bravo",
  "Aguilar", "Pardo", "Lorenzo", "Cano",
];

export const COACH_SURNAMES = [
  "Guardiola", "Simeone", "Mendilibar", "Bordalás", "Emery", "Alguacil", "Pellegrini",
  "Baraja", "Michel", "Arrasate", "Iraola", "Calero", "García Pimienta", "Vicente Moreno",
  "Lisci", "Martínez", "Sánchez", "Ferrer", "Ranieri", "Cid",
];

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** PRNG determinista (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
