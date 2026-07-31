// Progresión del estadio (ADR-013). Cada mejora sube el ingreso por asistencia en +2.000€ por
// punto de jornada. Secuencial: nivel 0 = base; nivel 13 = última mejora. Tuneable.

export const STADIUM_BASE_RATE = 10_000; // €/punto en el estadio base
export const STADIUM_RATE_STEP = 2_000; // +€/punto por cada mejora

/** Mejoras en orden. `cost` es el coste para alcanzar ese nivel (nivel = índice + 1). */
const UPGRADE_DEFS: { name: string; cost: number }[] = [
  { name: "Fase 1", cost: 10_000_000 },
  { name: "Fase 2", cost: 10_000_000 },
  { name: "Fase 3", cost: 10_000_000 },
  { name: "Fase 4", cost: 10_000_000 },
  { name: "Fase 5", cost: 5_000_000 },
  { name: "Fase 6", cost: 5_000_000 },
  { name: "Fase 7", cost: 5_000_000 },
  { name: "Fase 8", cost: 5_000_000 },
  { name: "Mejora césped", cost: 1_000_000 },
  { name: "Mejora accesos", cost: 1_000_000 },
  { name: "Mejora iluminación", cost: 2_000_000 },
  { name: "Mejora marcador", cost: 1_000_000 },
  { name: "Mejora parking", cost: 5_000_000 },
  { name: "Fase premium", cost: 20_000_000 },
];

export const MAX_STADIUM_LEVEL = UPGRADE_DEFS.length; // 13

export interface StadiumTier {
  level: number;
  name: string;
  cost: number; // coste para alcanzar este nivel
  rate: number; // €/punto en este nivel
}

/** Ingreso por asistencia (€/punto) en un nivel dado. */
export function attendanceRate(level: number): number {
  const l = Math.max(0, Math.min(level, MAX_STADIUM_LEVEL));
  return STADIUM_BASE_RATE + STADIUM_RATE_STEP * l;
}

export function tierName(level: number): string {
  if (level <= 0) return "Estadio base";
  return UPGRADE_DEFS[level - 1].name;
}

/** Mejora necesaria para pasar de `level` a `level+1`, o null si ya está al máximo. */
export function nextUpgrade(level: number): { name: string; cost: number } | null {
  if (level >= MAX_STADIUM_LEVEL) return null;
  return UPGRADE_DEFS[level];
}

/** Toda la progresión (base + 13 mejoras) para la UI. */
export function progression(): StadiumTier[] {
  const tiers: StadiumTier[] = [{ level: 0, name: "Estadio base", cost: 0, rate: attendanceRate(0) }];
  UPGRADE_DEFS.forEach((u, i) => tiers.push({ level: i + 1, name: u.name, cost: u.cost, rate: attendanceRate(i + 1) }));
  return tiers;
}

// --- Vallas publicitarias (ADR-013) -----------------------------------------
export const AD_SIDES = ["NORTH", "SOUTH", "EAST", "WEST"] as const;
export type AdSide = (typeof AD_SIDES)[number];
export const AD_SIDE_LABEL: Record<AdSide, string> = { NORTH: "Norte", SOUTH: "Sur", EAST: "Este", WEST: "Oeste" };

const AD_BRANDS = ["Nike", "Adidas", "Puma", "Red Bull", "Coca-Cola", "Spotify", "Santander", "Movistar", "Iberia", "Emirates", "Rakuten", "Estrella"];
const AD_MIN = 1_000_000;
const AD_MAX = 4_000_000;

/** Genera una oferta random (marca + importe) para una valla, 1 temporada. */
export function randomAdOffer(): { brand: string; amount: number } {
  const brand = AD_BRANDS[Math.floor(Math.random() * AD_BRANDS.length)];
  const amount = Math.round((AD_MIN + Math.random() * (AD_MAX - AD_MIN)) / 100_000) * 100_000;
  return { brand, amount };
}
