// Catálogo de criterios de puntuación de ENTRENADORES (ADR-011 + Fase 2). Cada liga puede
// activar/desactivar cada criterio y ponerle su valor (ADR-014). El proveedor/simulador da los
// "hechos" del partido; cada liga aplica su baremo.

export interface CoachCriterion {
  key: string;
  label: string;
  value: number; // valor recomendado por defecto
  enabledByDefault: boolean;
}

export const COACH_CRITERIA: CoachCriterion[] = [
  { key: "win", label: "Victoria", value: 10, enabledByDefault: true },
  { key: "draw", label: "Empate", value: 4, enabledByDefault: true },
  { key: "loss", label: "Derrota", value: -4, enabledByDefault: true },
  { key: "goalFor", label: "Por gol a favor", value: 1, enabledByDefault: true },
  { key: "goalAgainst", label: "Por gol en contra", value: -1, enabledByDefault: true },
  { key: "cleanSheet", label: "Portería a cero", value: 4, enabledByDefault: true },
  { key: "rout", label: "Goleada (≥3)", value: 3, enabledByDefault: true },
  { key: "thrashed", label: "Vapuleo (≥3)", value: -3, enabledByDefault: true },
  { key: "awayWin", label: "Victoria a domicilio", value: 3, enabledByDefault: true },
  { key: "homeLoss", label: "Derrota como local", value: -3, enabledByDefault: true },
  // Nuevos (Fase 2)
  { key: "redDirect", label: "Expulsión por roja directa", value: -8, enabledByDefault: true },
  { key: "doubleYellow", label: "Expulsión por doble amarilla", value: -4, enabledByDefault: true },
  { key: "comeback", label: "Remonta un partido", value: 4, enabledByDefault: true },
  { key: "blownLead", label: "Pierde un partido que iba ganando", value: -4, enabledByDefault: true },
  { key: "subGoal", label: "Un suplente marca gol", value: 3, enabledByDefault: true },
  { key: "subRed", label: "Un suplente es expulsado", value: -2, enabledByDefault: true },
];

export type CoachConfig = Record<string, { enabled: boolean; value: number }>;

export function defaultCoachConfig(): CoachConfig {
  return Object.fromEntries(COACH_CRITERIA.map((c) => [c.key, { enabled: c.enabledByDefault, value: c.value }]));
}

/** Mezcla los defaults del catálogo con los overrides de la liga. */
export function mergeCoachConfig(overrides: unknown): CoachConfig {
  const base = defaultCoachConfig();
  if (overrides && typeof overrides === "object") {
    for (const [k, v] of Object.entries(overrides as Record<string, { enabled?: boolean; value?: number }>)) {
      if (base[k] && v) base[k] = { enabled: v.enabled ?? base[k].enabled, value: v.value ?? base[k].value };
    }
  }
  return base;
}

/** Puntos = Σ (valor × hecho) de los criterios activos. `facts` son conteos/0-1 por clave. */
export function coachPointsFromFacts(facts: Record<string, number>, config: CoachConfig): number {
  let pts = 0;
  for (const [k, cfg] of Object.entries(config)) {
    if (cfg.enabled) pts += cfg.value * (facts[k] ?? 0);
  }
  return pts;
}

/** Hechos "de resultado" (sin eventos): los que dependen solo de goles y localía. */
export function resultFacts(gf: number, ga: number, isHome: boolean): Record<string, number> {
  const diff = gf - ga;
  return {
    win: diff > 0 ? 1 : 0,
    draw: diff === 0 ? 1 : 0,
    loss: diff < 0 ? 1 : 0,
    goalFor: gf,
    goalAgainst: ga,
    cleanSheet: ga === 0 ? 1 : 0,
    rout: diff >= 3 ? 1 : 0,
    thrashed: diff <= -3 ? 1 : 0,
    awayWin: diff > 0 && !isHome ? 1 : 0,
    homeLoss: diff < 0 && isHome ? 1 : 0,
  };
}
