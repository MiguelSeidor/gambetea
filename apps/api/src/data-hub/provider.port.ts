// Puerto del proveedor de datos — capa anticorrupción del Football Data Hub (ADR-001/005/006).
// Los adaptadores (`mock` ahora, `api-football` después) devuelven DTOs NEUTROS con IDs
// EXTERNOS del proveedor. El SyncService los mapea a IDs internos vía ProviderMapping.
// Ningún componente aguas abajo conoce al proveedor.

export type ProviderPosition = "GK" | "DEF" | "MID" | "FWD";

export interface ProviderCompetition {
  externalId: string;
  name: string;
  country: string;
  season: string; // "2025/26"
}

export interface ProviderTeam {
  externalId: string;
  name: string;
  shortName: string;
}

export interface ProviderPlayer {
  externalId: string;
  teamExternalId: string;
  name: string;
  position: ProviderPosition;
  rating: number; // calidad 55-94 (base del valor de mercado)
}

export interface ProviderCoach {
  externalId: string;
  teamExternalId: string;
  name: string;
}

export interface ProviderFixture {
  externalId: string;
  matchday: number;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  kickoff: string; // ISO 8601
}

// --- Datos "en vivo" de un partido (tras jugarse) ---
export type MatchEventKind =
  | "GOAL"
  | "ASSIST"
  | "YELLOW"
  | "RED"
  | "OWN_GOAL"
  | "PEN_SCORED"
  | "PEN_MISSED"
  | "PEN_SAVED"
  | "SUB_IN"
  | "SUB_OUT"
  | "INJURY";

export interface ProviderMatchEvent {
  minute: number;
  type: MatchEventKind;
  playerExternalId: string | null;
}

// Estadísticas de conteo por jugador y partido (agregados, no eventos discretos).
// Base del baremo enriquecido de jugadores (ADR-015). Todas opcionales → 0 por defecto.
export interface ProviderMatchStats {
  shotsOnTarget?: number; // incluye el/los tiro(s) del gol
  shotsWoodwork?: number;
  accurateCrosses?: number;
  interceptions?: number;
  tackles?: number;
  tacklesLastMan?: number;
  errorLeadingToGoal?: number;
  bigChancesCreated?: number;
  bigChancesMissed?: number;
  dribbles?: number; // regates exitosos (se puntúan por cada 2)
  penaltiesConceded?: number;
  penaltiesWon?: number;
  foulsWon?: number;
  foulsCommitted?: number;
  goalLineClearance?: number;
  saves?: number; // paradas (porteros; también campo que hace de portero)
  crossesClaimed?: number; // centros atajados (portero)
  passPct?: number; // % de pases acertados (0-100)
}

export interface ProviderAppearance {
  playerExternalId: string;
  started: boolean;
  minutes: number;
  stats?: ProviderMatchStats;
}

export interface ProviderMatchData {
  homeGoals: number;
  awayGoals: number;
  events: ProviderMatchEvent[];
  appearances: ProviderAppearance[];
}

/** Contrato que implementa cada adaptador de proveedor. */
export interface FootballDataProvider {
  readonly name: string; // "mock" | "api-football"
  getCompetition(): Promise<ProviderCompetition>;
  getTeams(): Promise<ProviderTeam[]>;
  getSquad(teamExternalId: string): Promise<ProviderPlayer[]>;
  /** Entrenadores. Si se pasan `teamExternalIds`, sólo se piden esos (reanudable, ahorra peticiones). */
  getCoaches(teamExternalIds?: string[]): Promise<ProviderCoach[]>;
  getFixtures(): Promise<ProviderFixture[]>;
  /** Resultado + eventos + alineaciones de un partido ya jugado (el mock lo simula). */
  getMatchData(fixtureExternalId: string): Promise<ProviderMatchData>;
}
