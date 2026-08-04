import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createProvider } from "../data-hub/providers/provider.factory";
import { PlayerLifecycleService } from "./player-lifecycle.service";

// Diff de sincronización del Hub (ADR-018/019): compara los squads reales del proveedor contra
// NUESTRA base de datos (que es la línea base) y aplica los cambios reales — altas, cambios de
// club, cambios de posición y bajas — generando noticias. Idempotente: si no hay cambios, no hace
// nada. Coste ~21 peticiones (1 teams + 20 squads), apto para el plan free.
@Injectable()
export class HubSyncService {
  private readonly log = new Logger("HubSync");

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: PlayerLifecycleService,
  ) {}

  async detectChanges() {
    const provider = createProvider();
    const season = await this.prisma.season.findFirst({ where: { current: true }, select: { id: true } });
    if (!season) throw new BadRequestException("No hay temporada activa. Rellena el Hub primero.");

    const changes = { newPlayers: 0, clubChanges: 0, positionChanges: 0, departures: 0, errors: 0 };

    // --- Equipos: mapa externalId -> internalId (crea el equipo si es nuevo) ---
    const teams = await provider.getTeams();
    const teamMaps = await this.prisma.providerMapping.findMany({ where: { provider: provider.name, entityType: "team" } });
    const teamExtToInt = new Map(teamMaps.map((m) => [m.externalId, m.internalId]));
    const teamNameOf = new Map(teams.map((t) => [t.externalId, t.name]));
    for (const t of teams) {
      if (!teamExtToInt.has(t.externalId)) {
        const created = await this.prisma.team.create({ data: { name: t.name, shortName: t.shortName } });
        await this.prisma.providerMapping.create({ data: { provider: provider.name, entityType: "team", externalId: t.externalId, internalId: created.id } });
        teamExtToInt.set(t.externalId, created.id);
      }
    }

    // --- Squads reales: externalId de jugador -> {nombre, posición, equipo, rating} ---
    const fetched = new Map<string, { name: string; position: "GK" | "DEF" | "MID" | "FWD"; teamExternalId: string; rating: number }>();
    for (const t of teams) {
      const squad = await provider.getSquad(t.externalId);
      for (const p of squad) fetched.set(p.externalId, { name: p.name, position: p.position, teamExternalId: t.externalId, rating: p.rating });
    }

    // --- Mapas de jugadores y nuestros jugadores activos del campeonato ---
    const playerMaps = await this.prisma.providerMapping.findMany({ where: { provider: provider.name, entityType: "player" } });
    const playerExtToInt = new Map(playerMaps.map((m) => [m.externalId, m.internalId]));
    const playerIntToExt = new Map(playerMaps.map((m) => [m.internalId, m.externalId]));
    const teamIntIds = [...teamExtToInt.values()];
    const ourPlayers = await this.prisma.player.findMany({
      where: { teamId: { in: teamIntIds }, status: "ACTIVE" },
      select: { id: true, position: true, teamId: true },
    });
    const ourById = new Map(ourPlayers.map((p) => [p.id, p]));

    // --- 1) Altas + cambios de club/posición ---
    for (const [extId, f] of fetched) {
      try {
        const intId = playerExtToInt.get(extId);
        const newTeamInt = teamExtToInt.get(f.teamExternalId) ?? null;
        if (!intId) {
          const player = await this.prisma.player.create({ data: { name: f.name, position: f.position, rating: f.rating || 70, teamId: newTeamInt } });
          await this.prisma.providerMapping.create({ data: { provider: provider.name, entityType: "player", externalId: extId, internalId: player.id } });
          await this.lifecycle.announceNewPlayer(player.id, player.name, teamNameOf.get(f.teamExternalId) ?? null);
          changes.newPlayers++;
          continue;
        }
        const our = ourById.get(intId);
        if (!our) continue; // mapeado pero no activo (se fue y reaparece) — se ignora en v1
        if (our.teamId !== newTeamInt && newTeamInt) {
          await this.lifecycle.changeClub(intId, newTeamInt);
          changes.clubChanges++;
        }
        if (our.position !== f.position) {
          await this.lifecycle.changePosition(intId, f.position);
          changes.positionChanges++;
        }
      } catch (e) {
        changes.errors++;
        this.log.warn(`Cambio no aplicado para ${extId}: ${(e as Error).message}`);
      }
    }

    // --- 2) Bajas: jugadores nuestros (activos) que ya no están en ningún squad ---
    for (const our of ourPlayers) {
      const ext = playerIntToExt.get(our.id);
      if (ext && !fetched.has(ext)) {
        try {
          // Por defecto se trata como traspaso a otra liga (compensa cláusula, lo más justo para el
          // mánager). La jubilación exacta se puede afinar con el endpoint de traspasos (ver ADR-018).
          await this.lifecycle.transferOut(our.id);
          changes.departures++;
        } catch (e) {
          changes.errors++;
          this.log.warn(`Baja no aplicada para ${our.id}: ${(e as Error).message}`);
        }
      }
    }

    const total = changes.newPlayers + changes.clubChanges + changes.positionChanges + changes.departures;
    this.log.log(`Diff del Hub (${provider.name}): ${total} cambios ${JSON.stringify(changes)}`);
    return { provider: provider.name, total, ...changes };
  }
}
