// Cliente de la API de Gambetea. Todo el frontend habla SOLO con nuestro backend
// (nunca con proveedores externos — regla de oro nº3). El token JWT se guarda en localStorage.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

/** URL del escudo de un equipo, servida por NUESTRO backend (proxy). null si el equipo es null. */
export function crestUrl(teamId: string | null | undefined): string | null {
  return teamId ? `${BASE}/teams/${teamId}/crest` : null;
}

const TOKEN_KEY = "gambetea.token";
const USER_KEY = "gambetea.user";
const LEAGUE_KEY = "gambetea.league";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
}

// --- Sesión (localStorage, solo en cliente) ---------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function setSession(token: string, user: SessionUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(LEAGUE_KEY);
}

export function getLeagueId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LEAGUE_KEY);
}

export function setLeagueId(id: string): void {
  window.localStorage.setItem(LEAGUE_KEY, id);
}

// --- Fetch base -------------------------------------------------------------

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = await res.json();
      msg = Array.isArray(data.message) ? data.message.join(", ") : data.message ?? msg;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Tipos de respuesta -----------------------------------------------------

export interface AuthResponse {
  accessToken: string;
  user: SessionUser;
}
export interface LeagueSummary {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  inviteCode: string;
  memberCount: number;
  season: string;
  competition: string;
}
export interface LeagueDetail {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  season: string;
  competition: string;
  members: { userId: string; displayName: string; role: string; teamName: string | null; joinedAt: string }[];
}
export type PlayerPos = "GK" | "DEF" | "MID" | "FWD";
/** Etiqueta corta en español para la posición (badge). El código interno (GK/DEF/MID/FWD) se
 *  mantiene como clase CSS para el color; esto es sólo el texto visible. Entrenador → "ENT". */
export const POS_SHORT: Record<PlayerPos, string> = { GK: "POR", DEF: "DEF", MID: "CEN", FWD: "DEL" };
export const COACH_SHORT = "ENT";
export interface RosterPlayer {
  id: string;
  name: string;
  position: PlayerPos;
  teamId: string | null;
  club: string | null;
  clubName: string | null;
  value: number;
  purchasePrice: number;
  points: number;
  injured: boolean;
  suspended: boolean;
}
export interface RosterCoach {
  id: string;
  name: string;
  teamId: string | null;
  club: string | null;
  clubName: string | null;
  value: number;
  purchasePrice: number;
  points: number;
}
export interface TeamView {
  id: string;
  name: string;
  budget: number;
  squadValue: number;
  totalWorth: number;
  squadSize: number;
  players: RosterPlayer[];
  coaches: RosterCoach[];
}
export interface LineupPlayer {
  id: string;
  name: string;
  position: PlayerPos;
  teamId: string | null;
  club: string | null;
  clubName: string | null;
  points: number;
  injured: boolean;
  suspended: boolean;
}
export type NewsType = "NEW_PLAYER" | "CLUB_CHANGE" | "TRANSFER_OUT" | "RETIREMENT" | "POSITION_CHANGE";
export interface NewsEvent {
  id: string;
  type: NewsType;
  playerName: string;
  from: string | null;
  to: string | null;
  createdAt: string;
}
export interface GameweekMatch {
  id: string;
  kickoff: string;
  status: string;
  home: string;
  homeShort: string;
  away: string;
  awayShort: string;
  homeGoals: number | null;
  awayGoals: number | null;
}
export interface LineupView {
  gameweek: { id: string; number: number; status: string; deadline: string };
  formation: string;
  captainId: string | null;
  coachId: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}
export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  manager: string;
  played: number;
  points: number;
}
export interface FantasyRules {
  squadSize: number;
  composition: Record<PlayerPos, number>;
  formations: Record<string, Record<"DEF" | "MID" | "FWD", number>>;
}
export interface GameweekRow {
  id: string;
  number: number;
  deadline: string;
  status: string;
  matches: number;
}
export interface MarketListing {
  listingId: string;
  kind: "PLAYER" | "COACH";
  asset: { id: string; name: string; position: PlayerPos | null; teamId: string | null; club: string | null; clubName: string | null; value: number; points: number; injured: boolean; suspended: boolean };
  askingPrice: number;
  closesAt: string;
  freeAgent: boolean;
  myBid: number | null;
}
export interface LeaguePlayer {
  playerId: string;
  name: string;
  position: PlayerPos;
  teamId: string | null;
  club: string | null;
  clubName: string | null;
  value: number;
  clause: number;
  ownerTeamId: string;
  ownerTeamName: string;
  mine: boolean;
  points: number;
  injured: boolean;
  suspended: boolean;
  listed: boolean;
  listingId: string | null;
  askingPrice: number | null;
  myBid: number | null;
}
export interface TransactionRow {
  id: string;
  type: "BUY" | "SELL" | "PRIZE" | "SALARY" | "INSURANCE" | "LOAN" | "LOAN_REPAY" | "STADIUM" | "COACH" | "ADJUST" | "COMPENSATION";
  amount: number;
  description: string | null;
  createdAt: string;
}
export type InsuranceTier = "BASIC" | "MEDIUM" | "ADVANCED";
export interface Loan {
  id: string;
  principal: number;
  installment: number;
  outstanding: number;
  paid: number;
  total: number;
  status: "ACTIVE" | "PAID";
}
export interface InsurancePolicy {
  playerId: string;
  playerName: string;
  tier: InsuranceTier;
  bonus: number;
}
export interface StadiumTier {
  level: number;
  name: string;
  cost: number;
  rate: number;
}
export interface StadiumView {
  level: number;
  name: string;
  rate: number;
  maxLevel: number;
  next: { name: string; cost: number } | null;
  progression: StadiumTier[];
}
export interface AdBoard {
  side: "NORTH" | "SOUTH" | "EAST" | "WEST";
  label: string;
  contract: { brand: string; amount: number } | null;
  offer: { id: string; brand: string; amount: number } | null;
}
export interface LeagueSettings {
  prizePerPoint: number;
  salaryRate: number;
  compensationStep: number;
  tvRights: number;
  initialBudget: number;
  clauseMultiplier: number;
}
export interface Criterion {
  key: string;
  label: string;
  enabled: boolean;
  value: number;
  default: number;
}
export type CriterionScope = "ALL" | "GK" | "DEF" | "MID" | "FWD";
export interface PlayerCriterion extends Criterion {
  scope: CriterionScope;
  raw: boolean;
}
export interface AdminTeamRow {
  id: string;
  name: string;
  budget: number;
  leagueId: string;
  league: string;
  manager: string;
}
export interface AdminOverview {
  leagues: { id: string; name: string }[];
  teams: AdminTeamRow[];
  gameweeks: { id: string; number: number; status: string }[];
}
export interface AdminPlayer {
  id: string;
  name: string;
  position: PlayerPos;
  teamId: string | null;
  rating: number;
  value: number;
}
export interface AdminTeamDetail {
  id: string;
  name: string;
  budget: number;
  leagueId: string;
  players: { playerId: string; name: string; position: PlayerPos; value: number; rating: number; purchasePrice: number }[];
  coaches: { coachId: string; name: string; value: number; purchasePrice: number }[];
  transactions: TransactionRow[];
}
export interface ResetRequest {
  id: string;
  userEmail: string;
  userName: string;
  createdAt: string;
}
export interface HubStatus {
  provider: string;
  season: string | null;
  apiSeason: string | null;
  teams: number;
  players: number;
  coaches: number;
  gameweeks: number;
  gameweeksPlayed: number;
  job: { name: string; status: "running" | "done" | "error"; message: string; at: string } | null;
}
export interface AdminAuditRow {
  id: string;
  action: string;
  target: string | null;
  detail: unknown;
  createdAt: string;
  admin: string;
}

// --- Endpoints --------------------------------------------------------------

export const api = {
  register: (body: { email: string; password: string; displayName: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body }),
  requestReset: (email: string) =>
    request<{ ok: boolean }>("/auth/request-reset", { method: "POST", body: { email } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  myLeagues: () => request<LeagueSummary[]>("/leagues"),
  league: (id: string) => request<LeagueDetail>(`/leagues/${id}`),
  createLeague: (body: { name: string; teamName?: string }) =>
    request<LeagueDetail>("/leagues", { method: "POST", body }),
  joinLeague: (body: { inviteCode: string; teamName?: string }) =>
    request<LeagueDetail>("/leagues/join", { method: "POST", body }),
  deleteLeague: (id: string) => request<{ deleted: string }>(`/leagues/${id}`, { method: "DELETE" }),
  gameweeks: (leagueId: string) => request<GameweekRow[]>(`/leagues/${leagueId}/gameweeks`),
  gameweekMatches: (leagueId: string, gwId: string) =>
    request<GameweekMatch[]>(`/leagues/${leagueId}/gameweeks/${gwId}/matches`),
  news: (leagueId: string) => request<NewsEvent[]>(`/leagues/${leagueId}/news`),

  team: (leagueId: string) => request<TeamView>(`/leagues/${leagueId}/team`),
  lineup: (leagueId: string, gameweekId?: string) =>
    request<LineupView>(`/leagues/${leagueId}/team/lineup${gameweekId ? `?gameweek=${gameweekId}` : ""}`),
  saveLineup: (
    leagueId: string,
    body: { gameweekId?: string; formation: string; starters: string[]; bench: string[]; captainId?: string; coachId?: string },
  ) => request<LineupView>(`/leagues/${leagueId}/team/lineup`, { method: "PUT", body }),

  standings: (leagueId: string) => request<StandingRow[]>(`/leagues/${leagueId}/standings`),
  rules: () => request<FantasyRules>("/fantasy/rules"),

  // Mercado
  market: (leagueId: string) => request<MarketListing[]>(`/leagues/${leagueId}/market`),
  placeBid: (leagueId: string, listingId: string, amount: number) =>
    request<{ listingId: string; amount: number }>(`/leagues/${leagueId}/market/listings/${listingId}/bids`, {
      method: "POST",
      body: { amount },
    }),
  sellPlayer: (leagueId: string, playerId: string) =>
    request<{ sold: string; price: number }>(`/leagues/${leagueId}/team/players/${playerId}/sell`, { method: "POST" }),
  listPlayer: (leagueId: string, playerId: string, askingPrice: number) =>
    request<{ playerId: string; askingPrice: number }>(`/leagues/${leagueId}/team/players/${playerId}/list`, { method: "POST", body: { askingPrice } }),
  unlistPlayer: (leagueId: string, playerId: string) =>
    request<{ playerId: string; unlisted: boolean }>(`/leagues/${leagueId}/team/players/${playerId}/unlist`, { method: "POST" }),
  payClause: (leagueId: string, playerId: string) =>
    request<{ player: string; clause: number }>(`/leagues/${leagueId}/market/clause/${playerId}`, { method: "POST" }),
  leaguePlayers: (leagueId: string) => request<LeaguePlayer[]>(`/leagues/${leagueId}/players`),
  transactions: (leagueId: string) => request<TransactionRow[]>(`/leagues/${leagueId}/transactions`),

  // Liquidación diaria (ADR-010). En producción la lanza el cron a las 06:00; este disparo
  // manual es solo para dev / fast-forward.
  tick: () =>
    request<{ ranAt: string; competitions: { competition: string; settledGameweek: number | null; playersValued: number; leagues: unknown[] }[] }>(
      "/admin/tick",
      { method: "POST" },
    ),

  // Finanzas: préstamos y seguro médico
  loans: (leagueId: string) => request<Loan[]>(`/leagues/${leagueId}/loans`),
  takeLoan: (leagueId: string, amount: number) =>
    request<{ id: string; principal: number; installment: number; installments: number }>(`/leagues/${leagueId}/loans`, {
      method: "POST",
      body: { amount },
    }),
  insurances: (leagueId: string) => request<InsurancePolicy[]>(`/leagues/${leagueId}/insurances`),
  insurePlayer: (leagueId: string, playerId: string, tier: InsuranceTier) =>
    request<{ playerId: string; tier: InsuranceTier }>(`/leagues/${leagueId}/team/players/${playerId}/insurance`, {
      method: "POST",
      body: { tier },
    }),
  cancelInsurance: (leagueId: string, playerId: string) =>
    request<{ playerId: string; cancelled: boolean }>(`/leagues/${leagueId}/team/players/${playerId}/insurance`, { method: "DELETE" }),

  // Estadio
  stadium: (leagueId: string) => request<StadiumView>(`/leagues/${leagueId}/stadium`),
  upgradeStadium: (leagueId: string) => request<StadiumView>(`/leagues/${leagueId}/stadium/upgrade`, { method: "POST" }),
  boards: (leagueId: string) => request<AdBoard[]>(`/leagues/${leagueId}/stadium/boards`),
  generateOffers: (leagueId: string) => request<AdBoard[]>(`/leagues/${leagueId}/stadium/boards/offers`, { method: "POST" }),
  acceptOffer: (leagueId: string, offerId: string) =>
    request<AdBoard[]>(`/leagues/${leagueId}/stadium/boards/offers/${offerId}/accept`, { method: "POST" }),

  // Config de liga (ADR-014)
  leagueSettings: (leagueId: string) => request<LeagueSettings>(`/leagues/${leagueId}/settings`),
  updateLeagueSettings: (leagueId: string, dto: Partial<LeagueSettings>) =>
    request<LeagueSettings>(`/leagues/${leagueId}/settings`, { method: "PATCH", body: dto }),
  coachCriteria: (leagueId: string) => request<Criterion[]>(`/leagues/${leagueId}/coach-criteria`),
  updateCoachCriteria: (leagueId: string, overrides: Record<string, { enabled: boolean; value: number }>) =>
    request<Criterion[]>(`/leagues/${leagueId}/coach-criteria`, { method: "PATCH", body: overrides }),
  playerCriteria: (leagueId: string) => request<PlayerCriterion[]>(`/leagues/${leagueId}/player-criteria`),
  updatePlayerCriteria: (leagueId: string, overrides: Record<string, { enabled: boolean; value: number }>) =>
    request<PlayerCriterion[]>(`/leagues/${leagueId}/player-criteria`, { method: "PATCH", body: overrides }),

  // Administración global (ADR-016) — sólo para cuentas admin
  adminOverview: () => request<AdminOverview>("/admin/overview"),
  adminTeam: (teamId: string) => request<AdminTeamDetail>(`/admin/teams/${teamId}`),
  adminAudit: () => request<AdminAuditRow[]>("/admin/audit"),
  adminMoney: (teamId: string, amount: number, reason?: string) =>
    request<{ teamId: string; budget: number }>(`/admin/teams/${teamId}/money`, { method: "POST", body: { amount, reason } }),
  adminUpdatePlayer: (playerId: string, dto: { name?: string; position?: string; rating?: number; value?: number }) =>
    request<AdminPlayer>(`/admin/players/${playerId}`, { method: "PATCH", body: dto }),
  adminReassign: (leagueId: string, dto: { playerId: string; toTeamId: string; price?: number; adjustMoney?: boolean }) =>
    request<{ playerId: string; from: string; to: string; price: number }>(`/admin/leagues/${leagueId}/reassign`, { method: "POST", body: dto }),
  adminSetScore: (dto: { fantasyTeamId: string; gameweekId: string; points: number }) =>
    request<{ points: number }>("/admin/fantasy-score", { method: "POST", body: dto }),
  adminRecompute: (gameweekId: string) =>
    request<{ playersScored: number; teamsScored: number }>(`/admin/gameweeks/${gameweekId}/recompute`, { method: "POST" }),
  adminTransferOut: (playerId: string) =>
    request<{ status: string; owners: number }>(`/admin/players/${playerId}/transfer-out`, { method: "POST" }),
  adminRetire: (playerId: string) =>
    request<{ status: string; owners: number }>(`/admin/players/${playerId}/retire`, { method: "POST" }),
  adminChangePosition: (playerId: string, position: string) =>
    request<{ position: string }>(`/admin/players/${playerId}/position`, { method: "POST", body: { position } }),
  adminHubStatus: () => request<HubStatus>("/admin/hub/status"),
  adminHubReset: () => request<{ truncated: number }>("/admin/hub/reset", { method: "POST" }),
  adminHubBackfill: () => request<{ started: boolean; job: string }>("/admin/hub/backfill", { method: "POST" }),
  adminHubPlay: (count: number) => request<{ started: boolean; job: string }>("/admin/hub/play", { method: "POST", body: { count } }),
  adminHubSyncChanges: () => request<{ started: boolean; job: string }>("/admin/hub/sync-changes", { method: "POST" }),
  adminResetRequests: () => request<ResetRequest[]>("/admin/reset-requests"),
  adminApproveReset: (id: string) => request<{ ok: boolean; tempPassword: string }>(`/admin/reset-requests/${id}/approve`, { method: "POST" }),
  adminRejectReset: (id: string) => request<{ ok: boolean }>(`/admin/reset-requests/${id}/reject`, { method: "POST" }),
};
