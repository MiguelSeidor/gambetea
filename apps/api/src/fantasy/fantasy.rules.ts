// Reglas de juego del motor Fantasy de jugadores (Sprint 6).
// Parámetros de balance — tuneables sin cambios de arquitectura.
// Fuente de verdad documentada en docs/07_FANTASY_RULES.md.

export type Position = "GK" | "DEF" | "MID" | "FWD";

/** Composición obligatoria de la plantilla: 15 jugadores. */
export const SQUAD_COMPOSITION: Record<Position, number> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

export const SQUAD_SIZE = 15;
export const STARTERS = 11;
export const BENCH = 4;

/**
 * Presupuesto inicial nominal (€). PROVISIONAL: sin efecto real hasta el mercado
 * (Sprint 8, ADR-009 economía), donde se rediseña con valoraciones reales.
 */
export const INITIAL_BUDGET = 100_000_000;

/** Formaciones permitidas: reparto de los 10 jugadores de campo (el GK es siempre 1). */
export const FORMATIONS: Record<string, Record<"DEF" | "MID" | "FWD", number>> = {
  "4-3-3": { DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { DEF: 3, MID: 5, FWD: 2 },
  "5-3-2": { DEF: 5, MID: 3, FWD: 2 },
  "3-4-3": { DEF: 3, MID: 4, FWD: 3 },
  "4-5-1": { DEF: 4, MID: 5, FWD: 1 },
  "5-4-1": { DEF: 5, MID: 4, FWD: 1 },
};

export const DEFAULT_FORMATION = "4-3-3";

/** Recuento de titulares por posición que exige una formación (incluye el GK). */
export function formationCounts(formation: string): Record<Position, number> {
  const f = FORMATIONS[formation];
  return { GK: 1, DEF: f.DEF, MID: f.MID, FWD: f.FWD };
}
