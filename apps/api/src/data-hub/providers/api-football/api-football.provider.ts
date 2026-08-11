// Adaptador `api-football` (datos reales, ADR-019). Implementa el mismo puerto que el `mock`,
// así que nada aguas abajo cambia. Capa gratuita: https://v3.football.api-sports.io + header
// x-apisports-key. Config por env: APIFOOTBALL_KEY, APIFOOTBALL_LEAGUE (140), APIFOOTBALL_SEASON.
//
// Capability map: se mapea lo que la API da; las métricas tipo Opta que no existen se dejan a 0
// (sus criterios de baremo se desactivan por defecto en ligas con este proveedor).

import {
  FootballDataProvider,
  MatchEventKind,
  ProviderCoach,
  ProviderCompetition,
  ProviderFixture,
  ProviderMatchData,
  ProviderMatchEvent,
  ProviderMatchStats,
  ProviderPlayer,
  ProviderPosition,
  ProviderTeam,
} from "../../provider.port";

const BASE = "https://v3.football.api-sports.io";

interface ApiEnvelope<T> {
  errors: unknown;
  results: number;
  paging?: { current: number; total: number };
  response: T;
}

function mapPosition(raw: string | null | undefined): ProviderPosition {
  const p = (raw ?? "").toLowerCase();
  if (p.startsWith("goal") || p === "g") return "GK";
  if (p.startsWith("def") || p === "d") return "DEF";
  if (p.startsWith("mid") || p === "m") return "MID";
  return "FWD"; // Attacker / F / desconocido
}

const MIN_INTERVAL_MS = 6500; // plan free: 10 req/min → ~1 cada 6s (dejamos margen)

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = "api-football";
  private readonly key = (process.env.APIFOOTBALL_KEY ?? "").trim();
  private readonly league = Number((process.env.APIFOOTBALL_LEAGUE ?? "140").trim());
  private readonly season = Number((process.env.APIFOOTBALL_SEASON ?? "2023").trim());
  // Nº de páginas de plantilla a pedir por equipo. El plan FREE limita `page` a 3 (≈60 jugadores),
  // que es TODA la plantilla disponible: las pedimos enteras para no dejarnos a nadie fuera y luego
  // ordenar por calidad. En un plan de pago se puede subir con APIFOOTBALL_SQUAD_PAGES.
  private readonly squadPages = Math.max(1, Number((process.env.APIFOOTBALL_SQUAD_PAGES ?? "3").trim()) || 3);
  // Tamaño del pool por equipo: nos quedamos con los N MEJORES por calidad. 40 para pruebas; en vivo
  // se pone APIFOOTBALL_SQUAD_LIMIT=0 → sin recorte (todos los jugadores).
  private readonly squadLimit = Math.max(0, Number((process.env.APIFOOTBALL_SQUAD_LIMIT ?? "40").trim()) || 0);
  // Cola serializada para respetar el límite de 10 peticiones/minuto del plan free.
  private throttleChain: Promise<void> = Promise.resolve();
  private lastCallAt = 0;

  private async throttle(): Promise<void> {
    this.throttleChain = this.throttleChain.then(async () => {
      const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - this.lastCallAt));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCallAt = Date.now();
    });
    return this.throttleChain;
  }

  private async envelope<T>(path: string): Promise<ApiEnvelope<T>> {
    if (!this.key) throw new Error("Falta APIFOOTBALL_KEY en el entorno");
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.throttle();
      const res = await fetch(`${BASE}/${path}`, { headers: { "x-apisports-key": this.key } });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 61_000)); // rate limit: esperar y reintentar
        continue;
      }
      if (!res.ok) throw new Error(`api-football ${path} → HTTP ${res.status}`);
      const body = (await res.json()) as ApiEnvelope<T>;
      if (body.errors && !Array.isArray(body.errors) && Object.keys(body.errors as object).length > 0) {
        throw new Error(`api-football ${path} → ${JSON.stringify(body.errors)}`);
      }
      return body;
    }
    throw new Error(`api-football ${path} → límite de peticiones (429) persistente`);
  }

  private async call<T>(path: string): Promise<T> {
    return (await this.envelope<T>(path)).response;
  }

  async getCompetition(): Promise<ProviderCompetition> {
    const resp = await this.call<{ league: { name: string }; country: { name: string } }[]>(`leagues?id=${this.league}`);
    const l = resp[0];
    const yy = this.season;
    return { externalId: String(this.league), name: l?.league.name ?? "La Liga", country: l?.country.name ?? "Spain", season: `${yy}/${(yy + 1) % 100}` };
  }

  async getTeams(): Promise<ProviderTeam[]> {
    const resp = await this.call<{ team: { id: number; name: string; code: string | null; logo: string | null } }[]>(`teams?league=${this.league}&season=${this.season}`);
    return resp.map((t) => ({ externalId: String(t.team.id), name: t.team.name, shortName: t.team.code ?? t.team.name.slice(0, 3).toUpperCase(), crestUrl: t.team.logo ?? null }));
  }

  async getSquad(teamExternalId: string): Promise<ProviderPlayer[]> {
    // Plantilla REAL de la temporada (no la actual): `players?team&season`, paginado.
    // El plan FREE limita el parámetro `page` a un máximo de 3; pedimos `squadPages` (2 por defecto)
    // para no fundir el presupuesto diario de peticiones.
    const out: ProviderPlayer[] = [];
    let page = 1;
    let total = 1;
    do {
      const env = await this.envelope<ApiSeasonPlayer[]>(`players?team=${teamExternalId}&season=${this.season}&page=${page}`);
      for (const item of env.response) {
        const g = item.statistics?.[0]?.games;
        out.push({ externalId: String(item.player.id), teamExternalId, name: item.player.name, position: mapPosition(g?.position), rating: ratingFromSeasonAvg(g?.rating) });
      }
      total = Math.min(env.paging?.total ?? 1, this.squadPages);
      page++;
    } while (page <= total);
    // Ordenamos por CALIDAD (mejores primero) y recortamos al pool, para no dejarnos a un crack
    // que caiga en la 2ª/3ª página. squadLimit = 0 → nos quedamos con todos (modo "en vivo").
    out.sort((a, b) => b.rating - a.rating);
    return this.squadLimit > 0 ? out.slice(0, this.squadLimit) : out;
  }

  async getCoaches(teamExternalIds?: string[]): Promise<ProviderCoach[]> {
    // Un entrenador por equipo (el actual). Barato: 1 req/equipo. Si `teamExternalIds` viene dado
    // (backfill reanudable), sólo pedimos esos y ahorramos la llamada a getTeams.
    const ids = teamExternalIds ?? (await this.getTeams()).map((t) => t.externalId);
    const coaches: ProviderCoach[] = [];
    for (const teamExternalId of ids) {
      const resp = await this.call<{ id: number; name: string }[]>(`coachs?team=${teamExternalId}`);
      const c = resp[0];
      if (c) coaches.push({ externalId: String(c.id), teamExternalId, name: c.name });
    }
    return coaches;
  }

  async getFixtures(): Promise<ProviderFixture[]> {
    const resp = await this.call<
      { fixture: { id: number; date: string; status: { short: string } }; teams: { home: { id: number }; away: { id: number } }; league: { round: string } }[]
    >(`fixtures?league=${this.league}&season=${this.season}`);
    return resp.map((f) => ({
      externalId: String(f.fixture.id),
      matchday: roundNumber(f.league.round),
      homeTeamExternalId: String(f.teams.home.id),
      awayTeamExternalId: String(f.teams.away.id),
      kickoff: f.fixture.date,
    }));
  }

  async getMatchData(fixtureExternalId: string): Promise<ProviderMatchData> {
    const [fx, events, playersResp] = await Promise.all([
      this.call<{ goals: { home: number | null; away: number | null }; teams: { home: { id: number }; away: { id: number } } }[]>(`fixtures?id=${fixtureExternalId}`),
      this.call<ApiEvent[]>(`fixtures/events?fixture=${fixtureExternalId}`),
      this.call<ApiTeamPlayers[]>(`fixtures/players?fixture=${fixtureExternalId}`),
    ]);
    const match = fx[0];
    const homeGoals = match?.goals.home ?? 0;
    const awayGoals = match?.goals.away ?? 0;

    const mappedEvents: ProviderMatchEvent[] = [];
    for (const e of events) {
      const kind = mapEventKind(e);
      if (!kind || !e.player?.id) continue;
      const minute = (e.time?.elapsed ?? 0) + (e.time?.extra ?? 0);
      mappedEvents.push({ minute, type: kind, playerExternalId: String(e.player.id) });
      // En api-football el asistente viene en `assist` del evento de gol → lo acreditamos.
      if (kind === "GOAL" && e.assist?.id) {
        mappedEvents.push({ minute, type: "ASSIST", playerExternalId: String(e.assist.id) });
      }
      if (kind === "SUB_IN" && e.assist?.id) {
        mappedEvents.push({ minute, type: "SUB_OUT", playerExternalId: String(e.assist.id) });
      }
    }

    const appearances: ProviderMatchData["appearances"] = [];
    for (const teamBlock of playersResp) {
      for (const pl of teamBlock.players) {
        const s = pl.statistics?.[0];
        if (!s) continue;
        const minutes = s.games?.minutes ?? 0;
        const started = s.games?.substitute === false;
        if (minutes === 0 && !started) continue; // no jugó
        // Penaltis parados/fallados que la API reporta en stats (no siempre como evento).
        if ((s.penalty?.saved ?? 0) > 0) mappedEvents.push({ minute: 0, type: "PEN_SAVED", playerExternalId: String(pl.player.id) });
        appearances.push({ playerExternalId: String(pl.player.id), started, minutes, stats: mapStats(s) });
      }
    }

    mappedEvents.sort((a, b) => a.minute - b.minute);
    return { homeGoals, awayGoals, events: mappedEvents, appearances };
  }
}

// --- Tipos parciales de la respuesta de API-Football ---
interface ApiEvent {
  time?: { elapsed?: number; extra?: number };
  player?: { id?: number };
  assist?: { id?: number };
  type?: string;
  detail?: string;
}
interface ApiPlayerStat {
  games?: { minutes?: number; substitute?: boolean; position?: string };
  shots?: { total?: number | null; on?: number | null };
  goals?: { total?: number | null; conceded?: number | null; assists?: number | null; saves?: number | null };
  passes?: { total?: number | null; key?: number | null; accuracy?: string | number | null };
  tackles?: { total?: number | null; blocks?: number | null; interceptions?: number | null };
  duels?: { total?: number | null; won?: number | null };
  dribbles?: { attempts?: number | null; success?: number | null };
  fouls?: { drawn?: number | null; committed?: number | null };
  cards?: { yellow?: number | null; red?: number | null };
  penalty?: { won?: number | null; commited?: number | null; scored?: number | null; missed?: number | null; saved?: number | null };
}
interface ApiTeamPlayers {
  players: { player: { id: number; name: string }; statistics: ApiPlayerStat[] }[];
}
interface ApiSeasonPlayer {
  player: { id: number; name: string };
  statistics: { games?: { position?: string | null; rating?: string | null } }[];
}

// Nota media de la temporada (≈6.0 flojo … 7.6 élite) → rating interno 55-94 (base del valor).
function ratingFromSeasonAvg(avg: string | null | undefined): number {
  const r = Number(avg);
  if (!Number.isFinite(r) || r <= 0) return 62; // sin nota (pocos minutos): valor modesto
  return Math.max(55, Math.min(94, Math.round(58 + (r - 6.0) * 21.5)));
}

function mapEventKind(e: ApiEvent): MatchEventKind | null {
  const type = (e.type ?? "").toLowerCase();
  const detail = (e.detail ?? "").toLowerCase();
  if (type === "goal") {
    if (detail.includes("own")) return "OWN_GOAL";
    if (detail.includes("missed")) return "PEN_MISSED";
    if (detail.includes("penalty")) return "PEN_SCORED";
    return "GOAL";
  }
  if (type === "card") return detail.includes("red") || detail.includes("second yellow") ? "RED" : "YELLOW";
  if (type === "subst") return "SUB_IN";
  return null;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && v > 0 ? v : 0;
}

function mapStats(s: ApiPlayerStat): ProviderMatchStats {
  return {
    shotsOnTarget: num(s.shots?.on),
    interceptions: num(s.tackles?.interceptions),
    tackles: num(s.tackles?.total),
    bigChancesCreated: num(s.passes?.key), // pases clave ≈ ocasiones creadas (mejor proxy disponible)
    dribbles: num(s.dribbles?.success),
    penaltiesConceded: num(s.penalty?.commited),
    penaltiesWon: num(s.penalty?.won),
    foulsWon: num(s.fouls?.drawn),
    foulsCommitted: num(s.fouls?.committed),
    saves: num(s.goals?.saves),
    passPct: s.passes?.accuracy != null ? Math.round(Number(s.passes.accuracy)) || 0 : 0,
    // No disponibles en API-Football (Opta): shotsWoodwork, accurateCrosses, tacklesLastMan,
    // errorLeadingToGoal, bigChancesMissed, goalLineClearance, crossesClaimed → quedan a 0.
  };
}

/** "Regular Season - 12" → 12. Otras rondas (playoffs) → 0. */
function roundNumber(round: string): number {
  const m = /(\d+)\s*$/.exec(round ?? "");
  return m ? Number(m[1]) : 0;
}
