// Parámetros de economía del juego (ADR-009). Tuneables, sin impacto de arquitectura.
// Todo el dinero en euros enteros.

export type Pos = "GK" | "DEF" | "MID" | "FWD";

/** Cada punto Fantasy acumulado en la temporada suma este valor (€). Recalibrado a la baja
 *  (ADR-017): con el baremo enriquecido (ADR-015) la puntuación media por jornada ~triplicó,
 *  así que el factor baja 200k→40k para que los valores (y el salario, % del valor) no exploten. */
export const POINTS_VALUE_FACTOR = 40_000;

/** Valor mínimo de un jugador (€). */
export const MIN_VALUE = 500_000;

/** Presupuesto inicial de cada equipo (€) antes de descontar el draft. */
export const INITIAL_BUDGET = 200_000_000;

/** Compensación por clasificación: (puesto − 1) × esto, tras cada jornada (catch-up). Recalibrado
 *  (ADR-017): 1M era un grifo excesivo (≈66M/jornada en una liga de 12) → 250k. */
export const COMPENSATION_STEP = 250_000;

/**
 * Valor base por CALIDAD (rating 55-94), curva convexa tipo Comuniazo: estrellas ~20M,
 * medios ~5M, suplentes ~0.5M. Reemplaza el valor plano por posición.
 */
export function ratingBaseValue(rating: number): number {
  const r = Math.max(55, Math.min(94, rating));
  return 500_000 + Math.round(Math.pow(r - 55, 2) * 13_000);
}

/** Cláusula de rescisión = valor × este multiplicador. */
export const CLAUSE_MULTIPLIER = 2;

/** Prima económica por punto de jornada (€). Recalibrado a 15k (ADR-017) con el baremo nuevo. */
export const PRIZE_PER_POINT = Number(process.env.PRIZE_PER_POINT ?? "15000");

/** Salario por jornada = este % del valor de la plantilla (jugadores + entrenadores). Sumidero
 *  principal para que el juego sea competitivo (no todos ricos). Configurable por env
 *  (SALARY_RATE) para calibrar sin recompilar; por defecto 1,8% (ADR-017). */
export const SALARY_RATE = Number(process.env.SALARY_RATE ?? "0.018");

/** Valor base de un entrenador sin historial (€). */
export const COACH_BASE_VALUE = 4_000_000;
/** Cada punto de temporada del entrenador suma este valor (€). */
export const COACH_POINTS_VALUE_FACTOR = 120_000;

/** Valor de un entrenador según sus puntos de temporada. */
export function computeCoachValue(seasonPoints: number): number {
  return Math.max(MIN_VALUE, COACH_BASE_VALUE + seasonPoints * COACH_POINTS_VALUE_FACTOR);
}

/** Valor de un entrenador según la FUERZA de su equipo (rating medio de su plantilla) + puntos.
 *  Diferencia a un técnico de un equipo grande de uno que pelea por no descender. */
export function coachValueFromStrength(avgTeamRating: number, seasonPoints: number): number {
  const base = Math.max(1_000_000, COACH_BASE_VALUE + Math.round((avgTeamRating - 70) * 300_000));
  return Math.max(MIN_VALUE, base + seasonPoints * COACH_POINTS_VALUE_FACTOR);
}

// --- Préstamos (ADR-012 · hipoteca francesa) --------------------------------
export const LOAN_RATE_TAE = 0.05; // 5% TAE
export const MAX_LOANS = 3; // máximo de préstamos activos por equipo
export const LOAN_MAX_PCT = 0.5; // importe máximo = 50% del patrimonio
export const SEASON_GAMEWEEKS = 38; // jornadas por temporada (prorrateo anual)

/** Tipo de interés por jornada equivalente al 5% TAE (efectivo, 38 jornadas ≈ 1 año). */
export function loanRatePerGameweek(): number {
  return Math.pow(1 + LOAN_RATE_TAE, 1 / SEASON_GAMEWEEKS) - 1;
}

/** Cuota constante (amortización francesa) para `principal` a `n` jornadas al tipo `i`. */
export function frenchInstallment(principal: number, i: number, n: number): number {
  if (n <= 0) return principal;
  if (i <= 0) return Math.ceil(principal / n);
  return Math.ceil((principal * i) / (1 - Math.pow(1 + i, -n)));
}

// --- Blindaje (ADR-021) -----------------------------------------------------
/** Máximo de blindajes activos por equipo. */
export const MAX_SHIELDS = 3;
/** Duración (días) de cada semana de blindaje antes de renovar/caducar. */
export const SHIELD_DURATION_DAYS = 7;

// --- Seguro médico (ADR-012) ------------------------------------------------
export type InsuranceTier = "BASIC" | "MEDIUM" | "ADVANCED";
// Coste recalibrado al alza (petición del owner): básico ×100, medio ×300, avanzado ×500 sobre
// el coste anual base. El prorrateo por jornada (anual/38) lo aplica economy.service.
export const INSURANCE: Record<InsuranceTier, { bonus: number; annualCost: number }> = {
  BASIC: { bonus: 1, annualCost: 10_000 * 100 }, // 1.000.000/año ≈ 26.316/jornada
  MEDIUM: { bonus: 3, annualCost: 20_000 * 300 }, // 6.000.000/año ≈ 157.895/jornada
  ADVANCED: { bonus: 5, annualCost: 30_000 * 500 }, // 15.000.000/año ≈ 394.737/jornada
};

/** Nº de jugadores agentes libres que se listan al generar un mercado. */
export const MARKET_ROUND_SIZE = 8;

/** Nº mínimo de entrenadores que debe haber siempre en el mercado (rotan a diario). */
export const MIN_MARKET_COACHES = 2;

/** Valor de mercado a partir de la CALIDAD (rating) y los puntos de temporada. */
export function computeValue(rating: number, seasonPoints: number): number {
  return Math.max(MIN_VALUE, ratingBaseValue(rating) + seasonPoints * POINTS_VALUE_FACTOR);
}

// --- Fluctuación del valor (ADR-022) ----------------------------------------
/** Peso EXTRA de los puntos de la última jornada (además del punto acumulado): recencia 3×F. */
export const RECENCY_EXTRA_FACTOR = 2 * POINTS_VALUE_FACTOR;
/** Variación máxima del valor por día (±). Suaviza la fluctuación y evita saltos absurdos. */
export const DAILY_VALUE_CAP = 0.08;
/** Oferta/demanda (v1, ligera): cada puja reciente sube y estar en venta baja, como % del valor base. */
export const PRESSURE_PER_BID = 0.02;
export const PRESSURE_LISTED = 0.03;
export const PRESSURE_CAP = 0.1;

/** Valor OBJETIVO de un jugador: calidad + rendimiento (con recencia) + presión de mercado. */
export function targetPlayerValue(rating: number, seasonPoints: number, lastGwPoints: number, marketPressure: number): number {
  const base = ratingBaseValue(rating) + seasonPoints * POINTS_VALUE_FACTOR + lastGwPoints * RECENCY_EXTRA_FACTOR + marketPressure;
  return Math.max(MIN_VALUE, Math.round(base));
}

/** Aplica el tope diario (±DAILY_VALUE_CAP) al acercar `value` desde `old` hacia `target`.
 *  En la primera valoración (old ≤ 0) se fija el objetivo directamente. */
export function cappedValue(oldValue: number, target: number): number {
  if (oldValue <= 0) return Math.max(MIN_VALUE, target);
  const up = Math.round(oldValue * (1 + DAILY_VALUE_CAP));
  const down = Math.round(oldValue * (1 - DAILY_VALUE_CAP));
  return Math.max(MIN_VALUE, Math.min(up, Math.max(down, target)));
}
