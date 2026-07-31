import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CLAUSE_MULTIPLIER } from "../market/economy.rules";

// Motor de consecuencias del ciclo de vida del jugador (ADR-018). Lo llaman: el admin global
// (mock/correcciones) y, en producción, el diff del SyncService contra el proveedor.
const POS_LABEL: Record<string, string> = { GK: "Portero", DEF: "Defensa", MID: "Centrocampista", FWD: "Delantero" };
const POSITIONS = ["GK", "DEF", "MID", "FWD"];
type EventType = "NEW_PLAYER" | "CLUB_CHANGE" | "TRANSFER_OUT" | "RETIREMENT" | "POSITION_CHANGE";

@Injectable()
export class PlayerLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentSeasonId(): Promise<string> {
    const s = await this.prisma.season.findFirst({ where: { current: true }, select: { id: true } });
    if (!s) throw new BadRequestException("No hay temporada activa");
    return s.id;
  }

  private async record(type: EventType, playerName: string, opts?: { playerId?: string; from?: string | null; to?: string | null }) {
    const seasonId = await this.currentSeasonId();
    await this.prisma.playerEvent.create({
      data: { seasonId, type, playerName, playerId: opts?.playerId ?? null, fromLabel: opts?.from ?? null, toLabel: opts?.to ?? null },
    });
  }

  /** Alta de un jugador (noticia). Lo llama el admin tras crear el jugador. */
  async announceNewPlayer(playerId: string, name: string, club: string | null) {
    await this.record("NEW_PLAYER", name, { playerId, to: club });
  }

  /** Cambio de club dentro del mismo campeonato: solo se actualiza el club. */
  async changeClub(playerId: string, newTeamId: string) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, include: { team: { select: { name: true } } } });
    if (!player) throw new NotFoundException("Jugador no encontrado");
    const team = await this.prisma.team.findUnique({ where: { id: newTeamId }, select: { name: true } });
    if (!team) throw new NotFoundException("Club no encontrado");
    await this.prisma.player.update({ where: { id: playerId }, data: { teamId: newTeamId } });
    await this.record("CLUB_CHANGE", player.name, { playerId, from: player.team?.name ?? null, to: team.name });
    return { playerId, club: team.name };
  }

  /** Cambio de posición (un medio pasa a delantero, etc.). */
  async changePosition(playerId: string, position: string) {
    if (!POSITIONS.includes(position)) throw new BadRequestException("Posición inválida");
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { name: true, position: true } });
    if (!player) throw new NotFoundException("Jugador no encontrado");
    await this.prisma.player.update({ where: { id: playerId }, data: { position: position as "GK" | "DEF" | "MID" | "FWD" } });
    await this.record("POSITION_CHANGE", player.name, { playerId, from: POS_LABEL[player.position], to: POS_LABEL[position] });
    return { playerId, position };
  }

  /** El jugador se va a OTRA liga: desaparece y cada dueño cobra su cláusula. */
  async transferOut(playerId: string) {
    return this.leaveLeague(playerId, true);
  }

  /** El jugador se retira: desaparece SIN compensación. */
  async retire(playerId: string) {
    return this.leaveLeague(playerId, false);
  }

  private async leaveLeague(playerId: string, compensate: boolean) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true, name: true, value: true, status: true } });
    if (!player) throw new NotFoundException("Jugador no encontrado");
    if (player.status !== "ACTIVE") throw new BadRequestException("El jugador ya no está activo en la liga");

    // Todos los equipos (de cualquier liga del campeonato) que lo tienen fichado.
    const rosters = await this.prisma.rosterPlayer.findMany({
      where: { playerId },
      select: { fantasyTeamId: true, fantasyTeam: { select: { membership: { select: { league: { select: { settings: { select: { clauseMultiplier: true } } } } } } } } },
    });
    for (const r of rosters) {
      if (compensate) {
        const mult = r.fantasyTeam.membership?.league.settings?.clauseMultiplier ?? CLAUSE_MULTIPLIER;
        const clause = player.value * mult;
        await this.prisma.$transaction([
          this.prisma.fantasyTeam.update({ where: { id: r.fantasyTeamId }, data: { budget: { increment: clause } } }),
          this.prisma.transaction.create({ data: { fantasyTeamId: r.fantasyTeamId, type: "SELL", amount: clause, description: `${player.name} ficha por otra liga · compensación de cláusula` } }),
        ]);
      } else {
        await this.prisma.transaction.create({ data: { fantasyTeamId: r.fantasyTeamId, type: "ADJUST", amount: 0, description: `${player.name} se retira · baja sin compensación` } });
      }
    }

    // Borrado en cascada Fantasy: plantillas, seguros, pujas + listings abiertas y alineaciones futuras.
    await this.prisma.rosterPlayer.deleteMany({ where: { playerId } });
    await this.prisma.playerInsurance.deleteMany({ where: { playerId } });
    const openListings = await this.prisma.marketListing.findMany({ where: { playerId, status: "OPEN" }, select: { id: true } });
    if (openListings.length) {
      const ids = openListings.map((l) => l.id);
      await this.prisma.bid.deleteMany({ where: { listingId: { in: ids } } });
      await this.prisma.marketListing.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED" } });
    }
    await this.prisma.fantasyLineupSlot.deleteMany({ where: { playerId, lineup: { gameweek: { status: { not: "FINISHED" } } } } });

    // El jugador sale del campeonato: status + teamId null → excluido de mercado/draft/valoración.
    await this.prisma.player.update({ where: { id: playerId }, data: { status: compensate ? "LEFT" : "RETIRED", teamId: null } });
    await this.record(compensate ? "TRANSFER_OUT" : "RETIREMENT", player.name, { playerId, to: compensate ? "otra liga" : null });
    return { playerId, status: compensate ? "LEFT" : "RETIRED", owners: rosters.length, compensated: compensate };
  }

  /** Feed de noticias del campeonato (por temporada). */
  async news(seasonId: string, limit = 20) {
    return this.prisma.playerEvent.findMany({ where: { seasonId }, orderBy: { createdAt: "desc" }, take: limit });
  }
}
