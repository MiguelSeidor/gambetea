import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { coachSeasonPointsMap, seasonPointsMap, statusMap } from "../fantasy/player-insights";
import { CLAUSE_MULTIPLIER, MARKET_ROUND_SIZE, MIN_MARKET_COACHES, SALARY_RATE } from "./economy.rules";
import { ValuationService } from "./valuation.service";

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuation: ValuationService,
  ) {}

  // === Lectura ================================================================

  async getMarket(userId: string, leagueId: string) {
    const { teamId, seasonId } = await this.resolveTeam(userId, leagueId);
    // Si la liga aún no tiene agentes libres (liga recién creada), se genera una ronda al vuelo.
    // En producción el mercado rota solo a las 00:00; esto evita ver el mercado vacío al empezar.
    const openFree = await this.prisma.marketListing.count({ where: { leagueId, status: "OPEN", sellerTeamId: null } });
    if (openFree === 0) {
      try { await this.generateListings(leagueId); } catch { /* sin agentes disponibles: se deja vacío */ }
    }
    // Sólo agentes libres aquí; los jugadores puestos en venta por otros equipos (sellerTeamId)
    // se listan como "transferibles" en getLeaguePlayers.
    const listings = await this.prisma.marketListing.findMany({
      where: { leagueId, status: "OPEN", sellerTeamId: null },
      orderBy: [{ kind: "asc" }, { closesAt: "asc" }],
      include: {
        player: { select: { id: true, name: true, position: true, value: true, team: { select: { id: true, name: true, shortName: true } } } },
        coach: { select: { id: true, name: true, value: true, team: { select: { id: true, name: true, shortName: true } } } },
        bids: { where: { fantasyTeamId: teamId }, select: { amount: true } },
      },
    });
    const [points, status, coachPoints] = await Promise.all([
      seasonPointsMap(this.prisma, seasonId),
      statusMap(this.prisma, seasonId),
      coachSeasonPointsMap(this.prisma, seasonId),
    ]);
    // Tabla unificada: jugadores y entrenadores con la misma forma (position=null en coach).
    return listings.map((l) => {
      const isCoach = l.kind === "COACH";
      const asset = isCoach ? l.coach! : l.player!;
      return {
        listingId: l.id,
        kind: l.kind,
        asset: {
          id: asset.id,
          name: asset.name,
          position: isCoach ? null : (l.player!.position as string),
          teamId: asset.team?.id ?? null,
          club: asset.team?.shortName ?? null,
          clubName: asset.team?.name ?? null,
          value: asset.value,
          points: isCoach ? (coachPoints.get(asset.id) ?? 0) : (points.get(asset.id) ?? 0),
          injured: isCoach ? false : (status.get(asset.id)?.injured ?? false),
          suspended: isCoach ? false : (status.get(asset.id)?.suspended ?? false),
        },
        askingPrice: l.askingPrice,
        closesAt: l.closesAt,
        freeAgent: l.sellerTeamId === null,
        myBid: l.bids[0]?.amount ?? null,
      };
    });
  }

  /** Todos los jugadores en propiedad dentro de la liga, con su cláusula, estado y si están en venta. */
  async getLeaguePlayers(userId: string, leagueId: string) {
    const { teamId, seasonId } = await this.resolveTeam(userId, leagueId);
    const roster = await this.prisma.rosterPlayer.findMany({
      where: { fantasyTeam: { membership: { leagueId } } },
      include: {
        player: { select: { id: true, name: true, position: true, value: true, team: { select: { id: true, name: true, shortName: true } } } },
        fantasyTeam: { select: { id: true, name: true } },
      },
      orderBy: { player: { value: "desc" } },
    });
    const mult = (await this.prisma.leagueSettings.findUnique({ where: { leagueId }, select: { clauseMultiplier: true } }))?.clauseMultiplier ?? CLAUSE_MULTIPLIER;
    const [points, status] = await Promise.all([seasonPointsMap(this.prisma, seasonId), statusMap(this.prisma, seasonId)]);
    // Jugadores puestos en venta por su dueño (transferibles) → se puede pujar.
    const listed = await this.prisma.marketListing.findMany({
      where: { leagueId, status: "OPEN", kind: "PLAYER", sellerTeamId: { not: null } },
      include: { bids: { where: { fantasyTeamId: teamId }, select: { amount: true } } },
    });
    const listedOf = new Map(listed.map((l) => [l.playerId!, l]));
    return roster.map((r) => {
      const l = listedOf.get(r.player.id);
      return {
        playerId: r.player.id,
        name: r.player.name,
        position: r.player.position,
        teamId: r.player.team?.id ?? null,
        club: r.player.team?.shortName ?? null,
        clubName: r.player.team?.name ?? null,
        value: r.player.value,
        clause: r.player.value * mult,
        ownerTeamId: r.fantasyTeam.id,
        ownerTeamName: r.fantasyTeam.name,
        mine: r.fantasyTeam.id === teamId,
        points: points.get(r.player.id) ?? 0,
        injured: status.get(r.player.id)?.injured ?? false,
        suspended: status.get(r.player.id)?.suspended ?? false,
        // Transferible: su dueño lo puso en venta con un precio de salida (por debajo de cláusula).
        listed: !!l,
        listingId: l?.id ?? null,
        askingPrice: l?.askingPrice ?? null,
        myBid: l?.bids[0]?.amount ?? null,
      };
    });
  }

  // === Transferibles: poner/quitar un jugador propio en venta (especulación) =====

  /** Pone a un jugador propio en venta con un precio de salida (por debajo de la cláusula). */
  async listPlayer(userId: string, leagueId: string, playerId: string, askingPrice: number) {
    const { teamId } = await this.resolveTeam(userId, leagueId);
    const roster = await this.prisma.rosterPlayer.findUnique({
      where: { fantasyTeamId_playerId: { fantasyTeamId: teamId, playerId } },
      include: { player: { select: { value: true } } },
    });
    if (!roster) throw new NotFoundException("No tienes a ese jugador");
    const existing = await this.prisma.marketListing.findFirst({ where: { leagueId, playerId, status: "OPEN" } });
    if (existing) throw new BadRequestException("Ese jugador ya está en el mercado");
    const price = Math.max(1, Math.round(askingPrice || roster.player.value));
    const closesAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.marketListing.create({
      data: { leagueId, kind: "PLAYER", playerId, sellerTeamId: teamId, askingPrice: price, closesAt },
    });
    return { playerId, askingPrice: price };
  }

  /** Retira de la venta un jugador propio (cancela su puja abierta). */
  async unlistPlayer(userId: string, leagueId: string, playerId: string) {
    const { teamId } = await this.resolveTeam(userId, leagueId);
    const listing = await this.prisma.marketListing.findFirst({
      where: { leagueId, playerId, status: "OPEN", sellerTeamId: teamId },
    });
    if (!listing) throw new NotFoundException("Ese jugador no está en venta por tu parte");
    await this.prisma.$transaction([
      this.prisma.bid.deleteMany({ where: { listingId: listing.id } }),
      this.prisma.marketListing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } }),
    ]);
    return { playerId, unlisted: true };
  }

  async getTransactions(userId: string, leagueId: string) {
    const { teamId } = await this.resolveTeam(userId, leagueId);
    const txs = await this.prisma.transaction.findMany({
      where: { fantasyTeamId: teamId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return txs.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt,
    }));
  }

  // === Puja =================================================================

  async placeBid(userId: string, leagueId: string, listingId: string, amount: number) {
    const { teamId, budget } = await this.resolveTeam(userId, leagueId);
    const listing = await this.prisma.marketListing.findFirst({
      where: { id: listingId, leagueId, status: "OPEN" },
    });
    if (!listing) throw new NotFoundException("Puja no disponible");
    if (listing.sellerTeamId === teamId) throw new BadRequestException("No puedes pujar por tu propio jugador en venta");
    if (amount < listing.askingPrice) {
      throw new BadRequestException("La puja no alcanza el precio de salida");
    }
    // Se puede pujar por encima del saldo (fichar te puede dejar en rojo, ADR-010), pero no
    // se puede iniciar una operación estando ya en números rojos. Sin límite de plantilla.
    if (budget < 0) throw new BadRequestException("Estás en números rojos: no puedes fichar hasta recuperarte");

    await this.prisma.bid.upsert({
      where: { listingId_fantasyTeamId: { listingId, fantasyTeamId: teamId } },
      create: { listingId, fantasyTeamId: teamId, amount },
      update: { amount },
    });
    return { listingId, amount };
  }

  // === Vender al banco ======================================================

  async sellPlayer(userId: string, leagueId: string, playerId: string) {
    const { teamId } = await this.resolveTeam(userId, leagueId);
    const roster = await this.prisma.rosterPlayer.findUnique({
      where: { fantasyTeamId_playerId: { fantasyTeamId: teamId, playerId } },
      include: { player: { select: { value: true, name: true } } },
    });
    if (!roster) throw new NotFoundException("No tienes a ese jugador");
    const size = await this.prisma.rosterPlayer.count({ where: { fantasyTeamId: teamId } });
    if (size <= 11) throw new BadRequestException("No puedes bajar de 11 jugadores");

    const price = roster.player.value;
    await this.prisma.$transaction([
      this.prisma.rosterPlayer.delete({ where: { id: roster.id } }),
      // El seguro es contractual: al perder al jugador se pierde el seguro.
      this.prisma.playerInsurance.deleteMany({ where: { fantasyTeamId: teamId, playerId } }),
      this.prisma.fantasyTeam.update({ where: { id: teamId }, data: { budget: { increment: price } } }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: teamId, type: "SELL", amount: price, description: `Venta de ${roster.player.name}` },
      }),
    ]);
    return { sold: playerId, price };
  }

  // === Cláusula de rescisión (compra directa a otro equipo) ==================

  async payClause(userId: string, leagueId: string, playerId: string) {
    const { teamId, budget } = await this.resolveTeam(userId, leagueId);
    const owned = await this.prisma.rosterPlayer.findFirst({
      where: { playerId, fantasyTeam: { membership: { leagueId } } },
      include: {
        player: { select: { value: true, name: true, position: true } },
        fantasyTeam: { select: { id: true } },
      },
    });
    if (!owned) throw new NotFoundException("Ese jugador no pertenece a nadie en la liga");
    if (owned.fantasyTeam.id === teamId) throw new BadRequestException("Ya es tuyo");

    const mult = (await this.prisma.leagueSettings.findUnique({ where: { leagueId }, select: { clauseMultiplier: true } }))?.clauseMultiplier ?? CLAUSE_MULTIPLIER;
    const clause = owned.player.value * mult;
    // Pagar una cláusula puede dejarte en rojo, pero no puedes iniciarla estando ya en rojo.
    if (budget < 0) throw new BadRequestException("Estás en números rojos: no puedes fichar hasta recuperarte");
    const sellerTeamId = owned.fantasyTeam.id;

    await this.prisma.$transaction([
      this.prisma.rosterPlayer.update({
        where: { id: owned.id },
        data: { fantasyTeamId: teamId, purchasePrice: clause, acquiredAt: new Date() },
      }),
      // El seguro no se traspasa: el vendedor lo pierde y el comprador no lo hereda.
      this.prisma.playerInsurance.deleteMany({ where: { fantasyTeamId: sellerTeamId, playerId } }),
      this.prisma.fantasyTeam.update({ where: { id: teamId }, data: { budget: { decrement: clause } } }),
      this.prisma.fantasyTeam.update({ where: { id: sellerTeamId }, data: { budget: { increment: clause } } }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: teamId, type: "BUY", amount: -clause, description: `Cláusula de ${owned.player.name}` },
      }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: sellerTeamId, type: "SELL", amount: clause, description: `Cláusula pagada por ${owned.player.name}` },
      }),
    ]);
    return { player: playerId, clause, from: sellerTeamId, to: teamId };
  }

  // === Admin: generar y resolver el mercado =================================

  /** Lista agentes libres (jugadores + entrenadores) para pujar. Garantiza ≥2 entrenadores. */
  async generateListings(leagueId: string, count = MARKET_ROUND_SIZE) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId }, select: { seasonId: true } });
    if (!league) throw new NotFoundException("Liga no encontrada");
    await this.valuation.ensureValues(league.seasonId);
    const closesAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Jugadores libres al azar.
    const chosenPlayers = shuffle(await this.freeAgents(leagueId, league.seasonId)).slice(0, count);
    const players = await this.prisma.player.findMany({ where: { id: { in: chosenPlayers } }, select: { id: true, value: true } });

    // Entrenadores: completar hasta el mínimo garantizado en el mercado.
    const openCoaches = await this.prisma.marketListing.count({ where: { leagueId, status: "OPEN", kind: "COACH" } });
    const needCoaches = Math.max(0, MIN_MARKET_COACHES - openCoaches);
    const chosenCoaches = shuffle(await this.freeCoaches(leagueId, league.seasonId)).slice(0, needCoaches);
    const coaches = await this.prisma.coach.findMany({ where: { id: { in: chosenCoaches } }, select: { id: true, value: true } });

    if (players.length + coaches.length === 0) throw new BadRequestException("No hay agentes libres disponibles");

    await this.prisma.marketListing.createMany({
      data: [
        ...players.map((p) => ({ leagueId, kind: "PLAYER" as const, playerId: p.id, sellerTeamId: null, askingPrice: p.value, closesAt })),
        ...coaches.map((c) => ({ leagueId, kind: "COACH" as const, coachId: c.id, sellerTeamId: null, askingPrice: c.value, closesAt })),
      ],
    });
    return { created: players.length + coaches.length, players: players.length, coaches: coaches.length };
  }

  /**
   * Cobra salarios (SALARY_RATE % del valor de cada activo) a todos los equipos de la
   * temporada de la jornada. Puede dejar en rojo. Idempotente por jornada (ADR-010).
   */
  async chargeSalaries(gameweekId: string): Promise<number> {
    const already = await this.prisma.transaction.count({ where: { gameweekId, type: "SALARY" } });
    if (already > 0) return 0;
    const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId }, select: { seasonId: true } });
    if (!gw) return 0;

    const teams = await this.prisma.fantasyTeam.findMany({
      where: { membership: { league: { seasonId: gw.seasonId } } },
      select: {
        id: true,
        roster: { select: { player: { select: { value: true } } } },
        rosterCoaches: { select: { coach: { select: { value: true } } } },
        membership: { select: { league: { select: { settings: { select: { salaryRate: true } } } } } },
      },
    });
    // Promo NO_SALARY: equipos exentos de salario esta jornada (catch-up).
    const exempt = new Set(
      (await this.prisma.teamPromo.findMany({ where: { gameweekId, kind: "NO_SALARY" }, select: { fantasyTeamId: true } })).map((p) => p.fantasyTeamId),
    );
    let charged = 0;
    for (const t of teams) {
      if (exempt.has(t.id)) continue;
      const rate = t.membership?.league.settings?.salaryRate ?? SALARY_RATE;
      const assets =
        t.roster.reduce((s, r) => s + r.player.value, 0) +
        t.rosterCoaches.reduce((s, r) => s + r.coach.value, 0);
      const salary = Math.round(assets * rate);
      if (salary <= 0) continue;
      await this.prisma.$transaction([
        this.prisma.fantasyTeam.update({ where: { id: t.id }, data: { budget: { decrement: salary } } }),
        this.prisma.transaction.create({
          data: { fantasyTeamId: t.id, type: "SALARY", amount: -salary, gameweekId, description: "Salarios de plantilla" },
        }),
      ]);
      charged++;
    }
    return charged;
  }

  /** Revaloriza a todos los jugadores de la temporada de la liga. */
  async refreshValuations(leagueId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { seasonId: true },
    });
    if (!league) throw new NotFoundException("Liga no encontrada");
    const updated = await this.valuation.refreshValues(league.seasonId);
    return { updated };
  }

  /** Resuelve todas las pujas abiertas de la liga: gana la más alta (empate → la primera).
   *  Se carga aunque deje al equipo en rojo; sin límite de plantilla (ADR-010/011). */
  async resolveMarket(leagueId: string) {
    const listings = await this.prisma.marketListing.findMany({
      where: { leagueId, status: "OPEN" },
      orderBy: { closesAt: "asc" },
      include: {
        player: { select: { name: true } },
        coach: { select: { name: true } },
        bids: { orderBy: [{ amount: "desc" }, { createdAt: "asc" }], take: 1 },
      },
    });

    const sales: { asset: string; winner: string; amount: number }[] = [];
    for (const listing of listings) {
      const top = listing.bids[0];
      if (!top) {
        await this.prisma.marketListing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } });
        continue;
      }
      const isCoach = listing.kind === "COACH";
      const name = isCoach ? listing.coach!.name : listing.player!.name;

      if (listing.sellerTeamId) {
        // Venta entre equipos (transferible): mover la propiedad y pagar al vendedor.
        const owned = await this.prisma.rosterPlayer.findFirst({
          where: { playerId: listing.playerId!, fantasyTeamId: listing.sellerTeamId },
          select: { id: true },
        });
        if (!owned || top.fantasyTeamId === listing.sellerTeamId) {
          // El jugador ya no es del vendedor (p. ej. cláusula) o el ganador es el propio dueño.
          await this.prisma.marketListing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } });
          continue;
        }
        await this.prisma.$transaction([
          this.prisma.rosterPlayer.update({ where: { id: owned.id }, data: { fantasyTeamId: top.fantasyTeamId, purchasePrice: top.amount, acquiredAt: new Date() } }),
          // El seguro es contractual: el vendedor lo pierde, el comprador no lo hereda.
          this.prisma.playerInsurance.deleteMany({ where: { fantasyTeamId: listing.sellerTeamId, playerId: listing.playerId! } }),
          this.prisma.fantasyTeam.update({ where: { id: top.fantasyTeamId }, data: { budget: { decrement: top.amount } } }),
          this.prisma.fantasyTeam.update({ where: { id: listing.sellerTeamId }, data: { budget: { increment: top.amount } } }),
          this.prisma.transaction.create({ data: { fantasyTeamId: top.fantasyTeamId, type: "BUY", amount: -top.amount, description: `Fichaje de ${name} (traspaso)` } }),
          this.prisma.transaction.create({ data: { fantasyTeamId: listing.sellerTeamId, type: "SELL", amount: top.amount, description: `Traspaso de ${name}` } }),
          this.prisma.marketListing.update({ where: { id: listing.id }, data: { status: "RESOLVED" } }),
        ]);
        sales.push({ asset: name, winner: top.fantasyTeamId, amount: top.amount });
        continue;
      }

      // Agente libre: alta nueva en la plantilla del ganador.
      const acquire = isCoach
        ? this.prisma.rosterCoach.create({ data: { fantasyTeamId: top.fantasyTeamId, coachId: listing.coachId!, purchasePrice: top.amount } })
        : this.prisma.rosterPlayer.create({ data: { fantasyTeamId: top.fantasyTeamId, playerId: listing.playerId!, purchasePrice: top.amount } });
      await this.prisma.$transaction([
        acquire,
        this.prisma.fantasyTeam.update({ where: { id: top.fantasyTeamId }, data: { budget: { decrement: top.amount } } }),
        this.prisma.transaction.create({
          data: { fantasyTeamId: top.fantasyTeamId, type: "BUY", amount: -top.amount, description: `Fichaje de ${name}` },
        }),
        this.prisma.marketListing.update({ where: { id: listing.id }, data: { status: "RESOLVED" } }),
      ]);
      sales.push({ asset: name, winner: top.fantasyTeamId, amount: top.amount });
    }
    return { processed: listings.length, sales };
  }

  // === Helpers ==============================================================

  private async resolveTeam(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { fantasyTeam: { select: { id: true, budget: true } }, league: { select: { seasonId: true } } },
    });
    if (!membership || !membership.fantasyTeam) throw new ForbiddenException("No perteneces a esta liga");
    return { teamId: membership.fantasyTeam.id, budget: membership.fantasyTeam.budget, seasonId: membership.league.seasonId };
  }

  private async freeAgents(leagueId: string, seasonId: string): Promise<string[]> {
    const matches = await this.prisma.match.findMany({
      where: { seasonId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const seasonPlayers = await this.prisma.player.findMany({
      where: { teamId: { in: teamIds }, status: "ACTIVE" },
      select: { id: true },
    });
    const owned = await this.prisma.rosterPlayer.findMany({
      where: { fantasyTeam: { membership: { leagueId } } },
      select: { playerId: true },
    });
    const listed = await this.prisma.marketListing.findMany({
      where: { leagueId, status: "OPEN", kind: "PLAYER" },
      select: { playerId: true },
    });
    const taken = new Set([...owned.map((o) => o.playerId), ...listed.map((l) => l.playerId)]);
    return seasonPlayers.map((p) => p.id).filter((id) => !taken.has(id));
  }

  private async freeCoaches(leagueId: string, seasonId: string): Promise<string[]> {
    const matches = await this.prisma.match.findMany({
      where: { seasonId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const seasonCoaches = await this.prisma.coach.findMany({ where: { teamId: { in: teamIds } }, select: { id: true } });
    const owned = await this.prisma.rosterCoach.findMany({
      where: { fantasyTeam: { membership: { leagueId } } },
      select: { coachId: true },
    });
    const listed = await this.prisma.marketListing.findMany({
      where: { leagueId, status: "OPEN", kind: "COACH" },
      select: { coachId: true },
    });
    const taken = new Set([...owned.map((o) => o.coachId), ...listed.map((l) => l.coachId)]);
    return seasonCoaches.map((c) => c.id).filter((id) => !taken.has(id));
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
