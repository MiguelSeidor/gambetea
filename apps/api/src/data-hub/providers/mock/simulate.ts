// Motor de simulación de partidos del proveedor `mock`. DETERMINISTA: la misma semilla
// (externalId del partido) produce siempre el mismo resultado → idempotente y reproducible.
// Genera resultado, eventos (goles, asistencias, tarjetas, cambios) y alineaciones (minutos).

import { ProviderMatchData, ProviderMatchEvent, ProviderMatchStats, ProviderPlayer } from "../../provider.port";
import { hashStr, mulberry32 } from "./laliga";

// Índices del XI titular dentro de una plantilla ordenada (2 GK, 7 DEF, 7 MID, 4 FWD): un 4-3-3.
const XI_INDEXES = [0, 2, 3, 4, 5, 9, 10, 11, 16, 17, 18];

const rating = (externalId: string) => 55 + (hashStr(externalId) % 40); // 55–94

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function poisson(lambda: number, rng: () => number) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** Peso de un jugador para marcar/asistir según su posición. */
function attackWeight(pos: ProviderPlayer["position"]) {
  return pos === "FWD" ? 6 : pos === "MID" ? 3 : pos === "DEF" ? 1 : 0;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted<T>(items: T[], weightFn: (t: T) => number, rng: () => number): T {
  const total = items.reduce((s, it) => s + weightFn(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function strength(xi: ProviderPlayer[]) {
  return xi.reduce((s, p) => s + rating(p.externalId), 0) / xi.length;
}

export function simulateMatch(
  fixtureExternalId: string,
  homeSquad: ProviderPlayer[],
  awaySquad: ProviderPlayer[],
): ProviderMatchData {
  const rng = mulberry32(hashStr(fixtureExternalId));

  const homeXI = XI_INDEXES.map((i) => homeSquad[i]);
  const awayXI = XI_INDEXES.map((i) => awaySquad[i]);
  const homeBench = homeSquad.filter((p) => !homeXI.includes(p));
  const awayBench = awaySquad.filter((p) => !awayXI.includes(p));

  const sh = strength(homeXI);
  const sa = strength(awayXI);
  const homeEG = clamp(0.9 + (sh - sa) / 22 + 0.35 /* ventaja de campo */, 0.2, 4.2);
  const awayEG = clamp(0.9 + (sa - sh) / 22, 0.2, 4.2);
  const homeGoals = poisson(homeEG, rng);
  const awayGoals = poisson(awayEG, rng);

  const events: ProviderMatchEvent[] = [];
  // Acumulador de estadísticas de conteo por jugador (base del baremo enriquecido, ADR-015).
  const stats = new Map<string, ProviderMatchStats>();
  const st = (id: string): ProviderMatchStats => {
    let s = stats.get(id);
    if (!s) {
      s = {};
      stats.set(id, s);
    }
    return s;
  };
  const bump = (id: string, key: keyof ProviderMatchStats, by = 1) => {
    const s = st(id);
    s[key] = (s[key] ?? 0) + by;
  };
  const randMinute = () => 1 + Math.floor(rng() * 90);
  const defendersOf = (xi: ProviderPlayer[]) => xi.filter((p) => p.position === "DEF");
  const gkOf = (xi: ProviderPlayer[]) => xi.find((p) => p.position === "GK");

  // Reparte los goles de un equipo: juego abierto / penalti / en propia puerta del rival.
  const addGoals = (xi: ProviderPlayer[], rival: ProviderPlayer[], n: number) => {
    for (let g = 0; g < n; g++) {
      const minute = randMinute();
      const roll = rng();
      if (roll < 0.03) {
        // Gol en propia puerta: lo mete un defensa del rival (cuenta para este equipo).
        const own = pick(defendersOf(rival).length ? defendersOf(rival) : rival, rng);
        events.push({ minute, type: "OWN_GOAL", playerExternalId: own.externalId });
      } else if (roll < 0.11) {
        // Gol de penalti: lo transforma un atacante; el tiro a puerta se contabiliza aparte.
        const taker = pickWeighted(xi, (p) => attackWeight(p.position) + 1, rng);
        events.push({ minute, type: "PEN_SCORED", playerExternalId: taker.externalId });
        bump(taker.externalId, "shotsOnTarget");
        awardPenalty(xi, rival, taker.externalId);
      } else {
        const scorer = pickWeighted(xi, (p) => attackWeight(p.position) * (rating(p.externalId) / 70), rng);
        events.push({ minute, type: "GOAL", playerExternalId: scorer.externalId });
        bump(scorer.externalId, "shotsOnTarget"); // el gol SIEMPRE suma tiro a puerta (nota *1)
        if (rng() < 0.65) {
          const mates = xi.filter((p) => p.externalId !== scorer.externalId);
          const assist = pickWeighted(mates, (p) => attackWeight(p.position) + 1, rng);
          events.push({ minute, type: "ASSIST", playerExternalId: assist.externalId });
          bump(assist.externalId, "bigChancesCreated");
        }
      }
    }
  };
  // Registra el penalti provocado/cometido (winnerId provoca; un defensa rival lo comete).
  function awardPenalty(attackers: ProviderPlayer[], rival: ProviderPlayer[], winnerId: string) {
    bump(winnerId, "penaltiesWon");
    bump(winnerId, "foulsWon"); // el provocado suma además falta recibida (nota *10) → total 3
    const conceder = pick(defendersOf(rival).length ? defendersOf(rival) : rival, rng);
    bump(conceder.externalId, "penaltiesConceded");
  }

  addGoals(homeXI, awayXI, homeGoals);
  addGoals(awayXI, homeXI, awayGoals);

  // Penaltis FALLADOS/PARADOS que no acaban en gol (no afectan al marcador). ~18% por partido.
  if (rng() < 0.18) {
    const attackers = rng() < 0.5 ? homeXI : awayXI;
    const rival = attackers === homeXI ? awayXI : homeXI;
    const minute = randMinute();
    const taker = pickWeighted(attackers, (p) => attackWeight(p.position) + 1, rng);
    awardPenalty(attackers, rival, taker.externalId);
    if (rng() < 0.55) {
      const keeper = gkOf(rival);
      if (keeper) {
        events.push({ minute, type: "PEN_SAVED", playerExternalId: keeper.externalId });
        bump(keeper.externalId, "saves"); // el penalti parado suma además la parada (nota *6) → 10
      } else {
        events.push({ minute, type: "PEN_MISSED", playerExternalId: taker.externalId });
      }
    } else {
      events.push({ minute, type: "PEN_MISSED", playerExternalId: taker.externalId });
    }
  }

  // Tarjetas: 0–4 amarillas por partido, y ~8% de roja.
  const yellows = Math.floor(rng() * 5);
  for (let y = 0; y < yellows; y++) {
    const side = rng() < 0.5 ? homeXI : awayXI;
    const player = side[Math.floor(rng() * side.length)];
    events.push({ minute: randMinute(), type: "YELLOW", playerExternalId: player.externalId });
    bump(player.externalId, "foulsCommitted");
  }
  if (rng() < 0.08) {
    const side = rng() < 0.5 ? homeXI : awayXI;
    const player = side[Math.floor(rng() * side.length)];
    events.push({ minute: 45 + Math.floor(rng() * 45), type: "RED", playerExternalId: player.externalId });
  }

  // Error garrafal que genera gol en contra: ~6% cuando el equipo encajó (defensa o portero).
  const chargeError = (xi: ProviderPlayer[], conceded: number) => {
    if (conceded > 0 && rng() < 0.06) {
      const backs = xi.filter((p) => p.position === "DEF" || p.position === "GK");
      if (backs.length) bump(pick(backs, rng).externalId, "errorLeadingToGoal");
    }
  };
  chargeError(homeXI, awayGoals);
  chargeError(awayXI, homeGoals);

  // Estadísticas de conteo por jugador según posición/rating/minutos (deterministas).
  const genStats = (p: ProviderPlayer, minutes: number) => {
    const share = minutes / 90;
    const q = rating(p.externalId) / 94;
    const n = (base: number, prob: number) => {
      let c = 0;
      for (let i = 0; i < base; i++) if (rng() < prob * share) c++;
      return c;
    };
    bump(p.externalId, "foulsWon", n(3, 0.25 + q * 0.2));
    bump(p.externalId, "foulsCommitted", n(3, 0.22));
    bump(p.externalId, "dribbles", n(6, 0.12 + q * 0.25 * (p.position === "FWD" || p.position === "MID" ? 1 : 0.2)));
    if (p.position === "GK") {
      bump(p.externalId, "saves", n(7, 0.35));
      bump(p.externalId, "crossesClaimed", n(5, 0.3));
      if (rng() < 0.05 * share) bump(p.externalId, "goalLineClearance");
      st(p.externalId).passPct = 55 + Math.floor(rng() * 35);
    } else if (p.position === "DEF") {
      bump(p.externalId, "tackles", n(6, 0.35));
      bump(p.externalId, "interceptions", n(6, 0.4));
      bump(p.externalId, "accurateCrosses", n(3, 0.15));
      if (rng() < 0.08 * share) bump(p.externalId, "tacklesLastMan");
      if (rng() < 0.04 * share) bump(p.externalId, "goalLineClearance");
      st(p.externalId).passPct = 60 + Math.floor(rng() * 35);
    } else if (p.position === "MID") {
      bump(p.externalId, "tackles", n(5, 0.28));
      bump(p.externalId, "interceptions", n(5, 0.28));
      bump(p.externalId, "accurateCrosses", n(4, 0.25));
      bump(p.externalId, "shotsOnTarget", n(3, 0.18 + q * 0.15));
      bump(p.externalId, "shotsWoodwork", n(1, 0.05));
      bump(p.externalId, "bigChancesCreated", n(3, 0.2 + q * 0.2));
      bump(p.externalId, "bigChancesMissed", n(2, 0.12));
      st(p.externalId).passPct = 55 + Math.floor(rng() * 40);
    } else {
      // FWD
      bump(p.externalId, "shotsOnTarget", n(4, 0.3 + q * 0.2));
      bump(p.externalId, "shotsWoodwork", n(2, 0.08));
      bump(p.externalId, "accurateCrosses", n(2, 0.15));
      bump(p.externalId, "bigChancesCreated", n(2, 0.15));
      bump(p.externalId, "bigChancesMissed", n(3, 0.22 + q * 0.1));
      bump(p.externalId, "tackles", n(2, 0.12));
      st(p.externalId).passPct = 50 + Math.floor(rng() * 40);
    }
  };

  // Alineaciones + cambios (3 por equipo, minutos 60–85).
  const appearances: ProviderMatchData["appearances"] = [];
  const applySide = (xi: ProviderPlayer[], bench: ProviderPlayer[]) => {
    const minutes = new Map<string, number>(xi.map((p) => [p.externalId, 90]));
    const subsIn = bench.slice(0, 3);
    // sale un titular de campo (no el portero) por cada suplente que entra
    const outfield = xi.filter((p) => p.position !== "GK");
    for (let s = 0; s < subsIn.length; s++) {
      const minute = 60 + Math.floor(rng() * 26);
      const out = outfield[Math.floor(rng() * outfield.length)];
      const inn = subsIn[s];
      minutes.set(out.externalId, minute);
      minutes.set(inn.externalId, 90 - minute);
      events.push({ minute, type: "SUB_OUT", playerExternalId: out.externalId });
      events.push({ minute, type: "SUB_IN", playerExternalId: inn.externalId });
    }
    // Lesiones: ~15% de que un titular se lesione; deja de jugar en ese minuto.
    if (rng() < 0.15) {
      const injured = xi[Math.floor(rng() * xi.length)];
      const minute = 10 + Math.floor(rng() * 80);
      const played = Math.min(minutes.get(injured.externalId) ?? 90, minute);
      minutes.set(injured.externalId, played);
      events.push({ minute: played, type: "INJURY", playerExternalId: injured.externalId });
    }
    for (const p of xi) {
      const m = minutes.get(p.externalId)!;
      genStats(p, m);
      appearances.push({ playerExternalId: p.externalId, started: true, minutes: m, stats: st(p.externalId) });
    }
    for (const p of subsIn) {
      const m = minutes.get(p.externalId) ?? 0;
      if (m > 0) genStats(p, m);
      appearances.push({ playerExternalId: p.externalId, started: false, minutes: m, stats: st(p.externalId) });
    }
  };
  applySide(homeXI, homeBench);
  applySide(awayXI, awayBench);

  events.sort((a, b) => a.minute - b.minute);
  return { homeGoals, awayGoals, events, appearances };
}
