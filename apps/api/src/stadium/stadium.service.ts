import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  AD_SIDES,
  AD_SIDE_LABEL,
  type AdSide,
  attendanceRate,
  MAX_STADIUM_LEVEL,
  nextUpgrade,
  progression,
  randomAdOffer,
  tierName,
} from "./stadium.rules";

@Injectable()
export class StadiumService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTeam(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { fantasyTeam: { select: { id: true, budget: true } } },
    });
    if (!membership || !membership.fantasyTeam) throw new ForbiddenException("No perteneces a esta liga");
    return membership.fantasyTeam;
  }

  /** Estadio del equipo (se crea a nivel base si no existe). */
  private async ensureStadium(fantasyTeamId: string) {
    const existing = await this.prisma.stadium.findUnique({ where: { fantasyTeamId } });
    if (existing) return existing;
    return this.prisma.stadium.create({ data: { fantasyTeamId, level: 0 } });
  }

  async getStadium(userId: string, leagueId: string) {
    const team = await this.resolveTeam(userId, leagueId);
    const stadium = await this.ensureStadium(team.id);
    return this.view(stadium.level);
  }

  async upgrade(userId: string, leagueId: string) {
    const team = await this.resolveTeam(userId, leagueId);
    const stadium = await this.ensureStadium(team.id);
    const next = nextUpgrade(stadium.level);
    if (!next) throw new BadRequestException("El estadio ya está al máximo nivel");
    if (team.budget < next.cost) throw new BadRequestException("No tienes saldo suficiente para esta mejora");

    await this.prisma.$transaction([
      this.prisma.stadium.update({ where: { id: stadium.id }, data: { level: { increment: 1 } } }),
      this.prisma.fantasyTeam.update({ where: { id: team.id }, data: { budget: { decrement: next.cost } } }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: team.id, type: "STADIUM", amount: -next.cost, description: `Mejora de estadio: ${next.name}` },
      }),
    ]);
    return this.view(stadium.level + 1);
  }

  private view(level: number) {
    return {
      level,
      name: tierName(level),
      rate: attendanceRate(level),
      maxLevel: MAX_STADIUM_LEVEL,
      next: nextUpgrade(level),
      progression: progression(),
    };
  }

  // === Vallas publicitarias (ADR-013) ========================================

  async getBoards(userId: string, leagueId: string) {
    const team = await this.resolveTeam(userId, leagueId);
    let [contracts, offers] = await Promise.all([
      this.prisma.adContract.findMany({ where: { fantasyTeamId: team.id } }),
      this.prisma.adBoardOffer.findMany({ where: { fantasyTeamId: team.id } }),
    ]);
    // Auto-oferta: cada valla libre (sin contrato) debe tener una oferta disponible ya, sin botón.
    const contractedSides = new Set(contracts.map((c) => c.side));
    const offeredSides = new Set(offers.map((o) => o.side));
    const missing = AD_SIDES.filter((s) => !contractedSides.has(s) && !offeredSides.has(s));
    if (missing.length) {
      await this.prisma.adBoardOffer.createMany({
        data: missing.map((side) => { const { brand, amount } = randomAdOffer(); return { fantasyTeamId: team.id, side, brand, amount }; }),
      });
      offers = await this.prisma.adBoardOffer.findMany({ where: { fantasyTeamId: team.id } });
    }
    const contractOf = new Map(contracts.map((c) => [c.side, c]));
    const offerOf = new Map(offers.map((o) => [o.side, o]));
    return AD_SIDES.map((side) => {
      const c = contractOf.get(side);
      const o = offerOf.get(side);
      return {
        side,
        label: AD_SIDE_LABEL[side],
        contract: c ? { brand: c.brand, amount: c.amount } : null,
        offer: c ? null : o ? { id: o.id, brand: o.brand, amount: o.amount } : null,
      };
    });
  }

  /** Genera ofertas random para las vallas SIN contrato (rota las anteriores). */
  async generateOffers(userId: string, leagueId: string) {
    const team = await this.resolveTeam(userId, leagueId);
    const contracts = await this.prisma.adContract.findMany({ where: { fantasyTeamId: team.id }, select: { side: true } });
    const contracted = new Set(contracts.map((c) => c.side));
    const free = AD_SIDES.filter((s) => !contracted.has(s));

    await this.prisma.adBoardOffer.deleteMany({ where: { fantasyTeamId: team.id, side: { in: free as unknown as AdSide[] } } });
    for (const side of free) {
      const { brand, amount } = randomAdOffer();
      await this.prisma.adBoardOffer.create({ data: { fantasyTeamId: team.id, side, brand, amount } });
    }
    return this.getBoards(userId, leagueId);
  }

  /** Acepta una oferta: contrata la valla 1 temporada y cobra el importe (ingreso). */
  async acceptOffer(userId: string, leagueId: string, offerId: string) {
    const team = await this.resolveTeam(userId, leagueId);
    const offer = await this.prisma.adBoardOffer.findFirst({ where: { id: offerId, fantasyTeamId: team.id } });
    if (!offer) throw new NotFoundException("Oferta no disponible");
    const existing = await this.prisma.adContract.findUnique({
      where: { fantasyTeamId_side: { fantasyTeamId: team.id, side: offer.side } },
    });
    if (existing) throw new BadRequestException("Esa valla ya tiene contrato esta temporada");

    const league = await this.prisma.league.findUnique({ where: { id: leagueId }, select: { seasonId: true } });
    await this.prisma.$transaction([
      this.prisma.adContract.create({
        data: { fantasyTeamId: team.id, side: offer.side, brand: offer.brand, amount: offer.amount, seasonId: league!.seasonId },
      }),
      this.prisma.fantasyTeam.update({ where: { id: team.id }, data: { budget: { increment: offer.amount } } }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: team.id, type: "STADIUM", amount: offer.amount, description: `Patrocinio ${offer.brand} (valla ${AD_SIDE_LABEL[offer.side as AdSide]})` },
      }),
      this.prisma.adBoardOffer.deleteMany({ where: { fantasyTeamId: team.id, side: offer.side } }),
    ]);
    return this.getBoards(userId, leagueId);
  }
}
