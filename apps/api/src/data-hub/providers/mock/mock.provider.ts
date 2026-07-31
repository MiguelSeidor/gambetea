// Adaptador `mock` — implementa FootballDataProvider generando LaLiga de forma DETERMINISTA.
// Master data (Sprint 2): competición, equipos, plantillas, entrenadores y calendario.
// La simulación de partidos/eventos llega en el Sprint 3.

import {
  FootballDataProvider,
  ProviderCoach,
  ProviderCompetition,
  ProviderFixture,
  ProviderMatchData,
  ProviderPlayer,
  ProviderPosition,
  ProviderTeam,
} from "../../provider.port";
import { COACH_SURNAMES, FIRST_NAMES, SEASON, SURNAMES, TEAMS, hashStr, mulberry32, slug } from "./laliga";
import { simulateMatch } from "./simulate";

// 20 jugadores por equipo (2 GK, 7 DEF, 7 MID, 4 FWD).
const SQUAD_SHAPE: ProviderPosition[] = [
  "GK", "GK",
  "DEF", "DEF", "DEF", "DEF", "DEF", "DEF", "DEF",
  "MID", "MID", "MID", "MID", "MID", "MID", "MID",
  "FWD", "FWD", "FWD", "FWD",
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export class MockProvider implements FootballDataProvider {
  readonly name = "mock";

  async getCompetition(): Promise<ProviderCompetition> {
    return { externalId: "laliga", name: "LaLiga", country: "España", season: SEASON };
  }

  async getTeams(): Promise<ProviderTeam[]> {
    return TEAMS.map((t) => ({ externalId: slug(t.name), name: t.name, shortName: t.short }));
  }

  async getSquad(teamExternalId: string): Promise<ProviderPlayer[]> {
    const rng = mulberry32(hashStr(teamExternalId));
    return SQUAD_SHAPE.map((position, i) => {
      const externalId = `${teamExternalId}-p${i + 1}`;
      return {
        externalId,
        teamExternalId,
        name: `${pick(FIRST_NAMES, rng)} ${pick(SURNAMES, rng)}`,
        position,
        rating: 55 + (hashStr(externalId) % 40), // misma fórmula que el simulador
      };
    });
  }

  async getCoaches(): Promise<ProviderCoach[]> {
    return TEAMS.map((t, i) => ({
      externalId: `${slug(t.name)}-coach`,
      teamExternalId: slug(t.name),
      name: COACH_SURNAMES[i % COACH_SURNAMES.length],
    }));
  }

  async getFixtures(): Promise<ProviderFixture[]> {
    const ids = TEAMS.map((t) => slug(t.name));
    const rounds = roundRobin(ids); // 19 rondas
    const fixtures: ProviderFixture[] = [];
    const base = new Date("2025-08-16T18:00:00.000Z");

    const addRound = (round: [string, string][], matchday: number) => {
      const day = new Date(base);
      day.setDate(day.getDate() + (matchday - 1) * 7);
      for (const [home, away] of round) {
        fixtures.push({
          externalId: `m${matchday}-${home}-${away}`,
          matchday,
          homeTeamExternalId: home,
          awayTeamExternalId: away,
          kickoff: day.toISOString(),
        });
      }
    };

    rounds.forEach((round, r) => addRound(round, r + 1)); // jornadas 1-19 (ida)
    rounds.forEach((round, r) =>
      addRound(round.map(([h, a]) => [a, h] as [string, string]), r + 20), // 20-38 (vuelta)
    );
    return fixtures;
  }

  private fixtureIndex?: Map<string, { home: string; away: string }>;

  private async indexFixtures() {
    if (!this.fixtureIndex) {
      const fx = await this.getFixtures();
      this.fixtureIndex = new Map(
        fx.map((f) => [f.externalId, { home: f.homeTeamExternalId, away: f.awayTeamExternalId }]),
      );
    }
    return this.fixtureIndex;
  }

  async getMatchData(fixtureExternalId: string): Promise<ProviderMatchData> {
    const idx = await this.indexFixtures();
    const fx = idx.get(fixtureExternalId);
    if (!fx) throw new Error(`Fixture desconocido: ${fixtureExternalId}`);
    const [home, away] = await Promise.all([this.getSquad(fx.home), this.getSquad(fx.away)]);
    return simulateMatch(fixtureExternalId, home, away);
  }
}

// Circle method: n equipos (par) → n-1 rondas de n/2 partidos.
function roundRobin(teams: string[]): [string, string][][] {
  const n = teams.length;
  const arr = teams.slice();
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop() as string); // rota manteniendo el primero fijo
  }
  return rounds;
}
