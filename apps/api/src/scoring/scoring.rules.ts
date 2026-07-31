// Reglas de puntuación de jugadores (ADR-008). Parámetros de balance tuneables.
// Inspiradas en el género (Comunio/FPL) pero propias. Se aplican sobre EVENTOS REALES.

export type Pos = "GK" | "DEF" | "MID" | "FWD";

export const POINTS = {
  /** Jugar entre 1 y 59 minutos. */
  appearanceUnder60: 1,
  /** Jugar 60 minutos o más. */
  appearance60: 2,
  /** Gol, según la posición del autor. */
  goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 } as Record<Pos, number>,
  /** Asistencia (cualquier posición). */
  assist: 3,
  /** Portería a cero (jugando ≥60 min y el equipo no encaja). */
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 } as Record<Pos, number>,
  /** Penalización por cada 2 goles encajados (solo GK y DEF que jugaron). */
  concededPer2: -1,
  yellow: -1,
  red: -3,
  ownGoal: -2,
  penMissed: -2,
  /** Penalti parado (solo GK). */
  penSaved: 5,
  /** Multiplicador del capitán (a nivel de equipo Fantasy). */
  captainMultiplier: 2,
} as const;

/** Minutos mínimos para portería a cero y para no penalizar por goles encajados parcialmente. */
export const CLEAN_SHEET_MIN_MINUTES = 60;
