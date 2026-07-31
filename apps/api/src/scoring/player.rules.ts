// Baremo de puntuación de JUGADORES como "reglas como datos" (ADR-008 + ADR-015).
// Mismo patrón que el baremo de entrenadores: catálogo de criterios + config por liga
// (activar/desactivar + valor). El motor separa HECHOS (globales, del simulador/proveedor)
// de la PUNTUACIÓN (config por liga aplicada al agregar el total del equipo Fantasy).
//
// Cada criterio tiene un `scope`: ALL (todos), o una posición concreta (GK/DEF/MID/FWD).
// Los HECHOS son cantidades ya resueltas por posición/contexto (goles, tiros, entradas, un
// 0/1 para portería a cero, etc.); el motor hace `puntos += hechos[clave] × valor`.
// Excepción: criterios `raw` (p. ej. la banda de % de pase de medios) aportan `hechos[clave]`
// directamente, porque su magnitud ya viene firmada por el dato (no es lineal en un valor).

import { Pos } from "./scoring.rules";

export type CriterionScope = "ALL" | Pos;

export interface PlayerCriterion {
  key: string;
  label: string;
  scope: CriterionScope;
  value: number;
  enabledByDefault: boolean;
  /** Si es `raw`, aporta hechos[clave] directamente (ignora `value`). */
  raw?: boolean;
}

// Baremo v1 (ADR-015). Valores recomendados por defecto; configurables por liga.
// Nota de diseño: el "gol" vale 7 pero SIEMPRE se contabiliza además el tiro a puerta (3),
// por lo que el simulador/proveedor incrementa `shotOnTarget` también al marcar → gol = 10.
// El penalti provocado vale 2 y además suma "falta recibida" (1) → total 3. El penalti parado
// vale 8 y además suma "parada" (2) → total 10. (Ver notas *1–*12 del baremo en ADR-015.)
export const PLAYER_CRITERIA: PlayerCriterion[] = [
  // --- GENERAL (cualquier posición) -----------------------------------------
  { key: "goal", label: "Gol", scope: "ALL", value: 7, enabledByDefault: true },
  { key: "decisiveGoal", label: "Gol decisivo (primera ventaja del ganador)", scope: "ALL", value: 9, enabledByDefault: true },
  { key: "penScored", label: "Gol de penalti", scope: "ALL", value: 5, enabledByDefault: true },
  { key: "ownGoal", label: "Gol en propia puerta", scope: "ALL", value: -3, enabledByDefault: true },
  { key: "assist", label: "Asistencia", scope: "ALL", value: 4, enabledByDefault: true },
  { key: "accurateCross", label: "Centro preciso", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "shotOnTarget", label: "Tiro a puerta", scope: "ALL", value: 3, enabledByDefault: true },
  { key: "shotWoodwork", label: "Tiro al palo", scope: "ALL", value: 2, enabledByDefault: true },
  { key: "interception", label: "Pase interceptado", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "tackle", label: "Entrada (tackle)", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "tackleLastMan", label: "Entrada con éxito siendo el último hombre", scope: "ALL", value: 2, enabledByDefault: true },
  { key: "errorGoal", label: "Error garrafal que genera gol en contra", scope: "ALL", value: -3, enabledByDefault: true },
  { key: "bigChanceCreated", label: "Gran ocasión creada", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "bigChanceMissed", label: "Gran ocasión fallada", scope: "ALL", value: -1, enabledByDefault: true },
  { key: "dribblesPer2", label: "Por cada 2 regates exitosos", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "penConceded", label: "Penalti cometido", scope: "ALL", value: -3, enabledByDefault: true },
  { key: "penWon", label: "Penalti provocado", scope: "ALL", value: 2, enabledByDefault: true },
  { key: "penMissed", label: "Penalti fallado", scope: "ALL", value: -5, enabledByDefault: true },
  { key: "penSaved", label: "Penalti parado", scope: "ALL", value: 8, enabledByDefault: true },
  { key: "yellow", label: "Tarjeta amarilla", scope: "ALL", value: -2, enabledByDefault: true },
  { key: "doubleYellow", label: "Doble tarjeta amarilla", scope: "ALL", value: -6, enabledByDefault: true },
  { key: "redDirect", label: "Tarjeta roja directa", scope: "ALL", value: -6, enabledByDefault: true },
  { key: "foulWon", label: "Falta recibida", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "foulCommitted", label: "Falta cometida", scope: "ALL", value: -1, enabledByDefault: true },
  { key: "goalLineClearance", label: "Salvar un gol bajo palos", scope: "ALL", value: 1, enabledByDefault: true },
  { key: "save", label: "Parada", scope: "ALL", value: 2, enabledByDefault: true },
  { key: "crossClaimed", label: "Centro atajado", scope: "ALL", value: 1, enabledByDefault: true },
  // --- PORTEROS --------------------------------------------------------------
  { key: "cleanSheetGK", label: "Portería a cero (portero, ≥75 min)", scope: "GK", value: 6, enabledByDefault: true },
  { key: "concededPerGoal", label: "Por cada gol recibido (portero)", scope: "GK", value: -3, enabledByDefault: true },
  { key: "gkWin", label: "Victoria (portero, ≥45 min)", scope: "GK", value: 4, enabledByDefault: true },
  { key: "gkDraw", label: "Empate (portero, ≥45 min)", scope: "GK", value: 1, enabledByDefault: true },
  { key: "gkLoss", label: "Derrota (portero, ≥45 min)", scope: "GK", value: -2, enabledByDefault: true },
  // --- DEFENSAS --------------------------------------------------------------
  { key: "cleanSheetDef", label: "Portería a cero (defensa, ≥75 min)", scope: "DEF", value: 6, enabledByDefault: true },
  // --- MEDIOS ----------------------------------------------------------------
  // % de pases acertados por bandas (0-25→-2, 25-50→-1, 50-75→+1, 75-100→+2). Es `raw`:
  // el hecho `passBand` ya trae los puntos firmados de la banda alcanzada.
  { key: "passBand", label: "% de pases acertados (medios, por banda)", scope: "MID", value: 1, enabledByDefault: true, raw: true },
];

export interface CriterionConfig {
  enabled: boolean;
  value: number;
}
export type PlayerConfig = Record<string, CriterionConfig>;

export function defaultPlayerConfig(): PlayerConfig {
  const cfg: PlayerConfig = {};
  for (const c of PLAYER_CRITERIA) cfg[c.key] = { enabled: c.enabledByDefault, value: c.value };
  return cfg;
}

/** Mezcla los overrides de una liga sobre el baremo por defecto (claves ausentes → default). */
export function mergePlayerConfig(overrides: unknown): PlayerConfig {
  const cfg = defaultPlayerConfig();
  if (overrides && typeof overrides === "object") {
    for (const c of PLAYER_CRITERIA) {
      const o = (overrides as Record<string, { enabled?: boolean; value?: number }>)[c.key];
      if (o && typeof o === "object") {
        cfg[c.key] = {
          enabled: typeof o.enabled === "boolean" ? o.enabled : cfg[c.key].enabled,
          value: typeof o.value === "number" ? o.value : cfg[c.key].value,
        };
      }
    }
  }
  return cfg;
}

const CRITERION = new Map(PLAYER_CRITERIA.map((c) => [c.key, c]));

/** Aplica el baremo (config de la liga) a los hechos de un jugador, respetando su posición. */
export function playerPointsFromFacts(facts: Record<string, number>, position: Pos, config: PlayerConfig): number {
  let points = 0;
  for (const c of PLAYER_CRITERIA) {
    if (c.scope !== "ALL" && c.scope !== position) continue;
    const cfg = config[c.key];
    if (!cfg || !cfg.enabled) continue;
    const qty = facts[c.key] ?? 0;
    if (qty === 0) continue;
    points += c.raw ? qty : qty * cfg.value;
  }
  return points;
}

/** Desglose por concepto (para auditar), aplicando la config de la liga. */
export function playerBreakdown(facts: Record<string, number>, position: Pos, config: PlayerConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of PLAYER_CRITERIA) {
    if (c.scope !== "ALL" && c.scope !== position) continue;
    const cfg = config[c.key];
    if (!cfg || !cfg.enabled) continue;
    const qty = facts[c.key] ?? 0;
    if (qty === 0) continue;
    out[c.key] = c.raw ? qty : qty * cfg.value;
  }
  return out;
}

/** Puntos firmados de la banda de % de pase (medios). Devuelve 0 fuera de rango. */
export function passBandPoints(passPct: number): number {
  if (passPct <= 0) return 0;
  if (passPct < 25) return -2;
  if (passPct < 50) return -1;
  if (passPct < 75) return 1;
  return 2;
}
