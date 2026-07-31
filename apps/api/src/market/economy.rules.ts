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

// --- Seguro médico (ADR-012) ------------------------------------------------
export type InsuranceTier = "BASIC" | "MEDIUM" | "ADVANCED";
export const INSURANCE: Record<InsuranceTier, { bonus: number; annualCost: number }> = {
  BASIC: { bonus: 1, annualCost: 10_000 },
  MEDIUM: { bonus: 3, annualCost: 20_000 },
  ADVANCED: { bonus: 5, annualCost: 30_000 },
};

/** Nº de jugadores agentes libres que se listan al generar un mercado. */
export const MARKET_ROUND_SIZE = 8;

/** Nº mínimo de entrenadores que debe haber siempre en el mercado (rotan a diario). */
export const MIN_MARKET_COACHES = 2;

/** Valor de mercado a partir de la CALIDAD (rating) y los puntos de temporada. */
export function computeValue(rating: number, seasonPoints: number): number {
  return Math.max(MIN_VALUE, ratingBaseValue(rating) + seasonPoints * POINTS_VALUE_FACTOR);
}
