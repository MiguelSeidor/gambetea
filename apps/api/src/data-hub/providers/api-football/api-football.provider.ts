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
const DEFAULT_RATING = 70; // API-Football no da rating de calidad tipo FIFA (ADR-019).

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

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = "api-football";
  private readonly key = process.env.APIFOOTBALL_KEY ?? "";
  private readonly league = Number(process.env.APIFOOTBALL_LEAGUE ?? "140"); // LaLiga
  private readonly season = Number(process.env.APIFOOTBALL_SEASON ?? "2023");

  private async call<T>(path: string): Promise<T> {
    if (!this.key) throw new Error("Falta APIFOOTBALL_KEY en el entorno");
    const res = await fetch(`${BASE}/${path}`, { headers: { "x-apisports-key": this.key } });
    if (!res.ok) throw new Error(`api-football ${path} → HTTP ${res.status}`);
    const body = (await res.json()) as ApiEnvelope<T>;
    if (body.errors && !Array.isArray(body.errors) && Object.keys(body.errors as object).length > 0) {
      throw new Error(`api-football ${path} → ${JSON.stringify(body.errors)}`);
    }
    return body.response;
  }

  async getCompetition(): Promise<ProviderCompetition> {
    const resp = await this.call<{ league: { name: string }; country: { name: string } }[]>(`leagues?id=${this.league}`);
    const l = resp[0];
    const yy = this.season;
    return { externalId: String(this.league), name: l?.league.name ?? "La Liga", country: l?.country.name ?? "Spain", season: `${yy}/${(yy + 1) % 100}` };
  }

  async getTeams(): Promise<ProviderTeam[]> {
    const resp = await this.call<{ team: { id: number; name: string; code: string | null } }[]>(`teams?league=${this.league}&season=${this.season}`);
    return resp.map((t) => ({ externalId: String(t.team.id), name: t.team.name, shortName: t.team.code ?? t.team.name.slice(0, 3).toUpperCase() }));
  }

  async getSquad(teamExternalId: string): Promise<ProviderPlayer[]> {
    // players/squads = squad actual (1 req/equipo). Aproximación al de la temporada (ADR-019).
    const resp = await this.call<{ players: { id: number; name: string; position: string }[] }[]>(`players/squads?team=${teamExternalId}`);
    const players = resp[0]?.players ?? [];
    return players.map((p) => ({
      externalId: String(p.id),
      teamExternalId,
      name: p.name,
      position: mapPosition(p.position),
      rating: DEFAULT_RATING,
    }));
  }

  async getCoaches(): Promise<ProviderCoach[]> {
    // Un entrenador por equipo (el actual). Barato: 1 req/equipo.
    const teams = await this.getTeams();
    const coaches: ProviderCoach[] = [];
    for (const t of teams) {
      const resp = await this.call<{ id: number; name: string }[]>(`coachs?team=${t.externalId}`);
      const c = resp[0];
      if (c) coaches.push({ externalId: String(c.id), teamExternalId: t.externalId, name: c.name });
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
      mappedEvents.push({ minute: (e.time?.elapsed ?? 0) + (e.time?.extra ?? 0), type: kind, playerExternalId: String(e.player.id) });
      if (kind === "SUB_IN" && e.assist?.id) {
        mappedEvents.push({ minute: (e.time?.elapsed ?? 0) + (e.time?.extra ?? 0), type: "SUB_OUT", playerExternalId: String(e.assist.id) });
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
