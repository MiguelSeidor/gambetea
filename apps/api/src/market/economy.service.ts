import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  frenchInstallment,
  INSURANCE,
  LOAN_MAX_PCT,
  loanRatePerGameweek,
  MAX_LOANS,
  SEASON_GAMEWEEKS,
  type InsuranceTier,
} from "./economy.rules";

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolve(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { fantasyTeam: { select: { id: true, budget: true } }, league: { select: { seasonId: true } } },
    });
    if (!membership || !membership.fantasyTeam) throw new ForbiddenException("No perteneces a esta liga");
    return { teamId: membership.fantasyTeam.id, budget: membership.fantasyTeam.budget, seasonId: membership.league.seasonId };
  }

  private async patrimonio(teamId: string, budget: number): Promise<number> {
    const [players, coaches] = await Promise.all([
      this.prisma.rosterPlayer.findMany({ where: { fantasyTeamId: teamId }, include: { player: { select: { value: true } } } }),
      this.prisma.rosterCoach.findMany({ where: { fantasyTeamId: teamId }, include: { coach: { select: { value: true } } } }),
    ]);
    const assets = players.reduce((s, r) => s + r.player.value, 0) + coaches.reduce((s, r) => s + r.coach.value, 0);
    return budget + assets;
  }

  // === Préstamos ==============================================================

  async takeLoan(userId: string, leagueId: string, amount: number) {
    const { teamId, budget, seasonId } = await this.resolve(userId, leagueId);
    if (amount <= 0) throw new BadRequestException("Importe no válido");

    const active = await this.prisma.loan.count({ where: { fantasyTeamId: teamId, status: "ACTIVE" } });
    if (active >= MAX_LOANS) throw new BadRequestException(`Máximo ${MAX_LOANS} préstamos activos`);

    const worth = await this.patrimonio(teamId, budget);
    const max = Math.floor(worth * LOAN_MAX_PCT);
    if (amount > max) throw new BadRequestException(`El máximo para tu patrimonio es ${max} €`);

    const remaining = await this.prisma.gameweek.count({ where: { seasonId, status: { not: "FINISHED" } } });
    const n = Math.max(1, remaining);
    const i = loanRatePerGameweek();
    const installment = frenchInstallment(amount, i, n);

    const [loan] = await this.prisma.$transaction([
      this.prisma.loan.create({
        data: { fantasyTeamId: teamId, principal: amount, ratePerGw: i, installment, outstanding: amount, installmentsTotal: n },
      }),
      this.prisma.fantasyTeam.update({ where: { id: teamId }, data: { budget: { increment: amount } } }),
      this.prisma.transaction.create({
        data: { fantasyTeamId: teamId, type: "LOAN", amount, description: `Préstamo (cuota ${installment} × ${n} jornadas)` },
      }),
    ]);
    return { id: loan.id, principal: amount, installment, installments: n, ratePerGw: i };
  }

  async getLoans(userId: string, leagueId: string) {
    const { teamId } = await this.resolve(userId, leagueId);
    const loans = await this.prisma.loan.findMany({ where: { fantasyTeamId: teamId }, orderBy: { createdAt: "desc" } });
    return loans.map((l) => ({
      id: l.id,
      principal: l.principal,
      installment: l.installment,
      outstanding: l.outstanding,
      paid: l.installmentsPaid,
      total: l.installmentsTotal,
      status: l.status,
    }));
  }

  /** Cobra una cuota por jornada de cada préstamo activo. Idempotente (lastChargedGameweekId). */
  async chargeLoanInstallments(gameweekId: string): Promise<number> {
    const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId }, select: { seasonId: true } });
    if (!gw) return 0;
    const loans = await this.prisma.loan.findMany({
      where: { status: "ACTIVE", fantasyTeam: { membership: { league: { seasonId: gw.seasonId } } } },
    });
    let charged = 0;
    for (const loan of loans) {
      if (loan.lastChargedGameweekId === gameweekId) continue;
      const interest = Math.round(loan.outstanding * loan.ratePerGw);
      const isLast = loan.installmentsPaid + 1 >= loan.installmentsTotal;
      const pay = isLast ? loan.outstanding + interest : loan.installment;
      const newOutstanding = isLast ? 0 : Math.max(0, loan.outstanding - (loan.installment - interest));
      const done = isLast || newOutstanding <= 0;
      await this.prisma.$transaction([
        this.prisma.fantasyTeam.update({ where: { id: loan.fantasyTeamId }, data: { budget: { decrement: pay } } }),
        this.prisma.transaction.create({
          data: { fantasyTeamId: loan.fantasyTeamId, type: "LOAN_REPAY", amount: -pay, gameweekId, description: "Cuota de préstamo" },
        }),
        this.prisma.loan.update({
          where: { id: loan.id },
          data: {
            outstanding: newOutstanding,
            installmentsPaid: { increment: 1 },
            lastChargedGameweekId: gameweekId,
            status: done ? "PAID" : "ACTIVE",
          },
        }),
      ]);
      charged++;
    }
    return charged;
  }

  // === Seguro médico ==========================================================

  async contractInsurance(userId: string, leagueId: string, playerId: string, tier: InsuranceTier) {
    const { teamId } = await this.resolve(userId, leagueId);
    if (!INSURANCE[tier]) throw new BadRequestException("Nivel de seguro no válido");
    const owns = await this.prisma.rosterPlayer.count({ where: { fantasyTeamId: teamId, playerId } });
    if (owns === 0) throw new BadRequestException("Ese jugador no está en tu plantilla");
    await this.prisma.playerInsurance.upsert({
      where: { fantasyTeamId_playerId: { fantasyTeamId: teamId, playerId } },
      create: { fantasyTeamId: teamId, playerId, tier },
      update: { tier },
    });
    return { playerId, tier };
  }

  async cancelInsurance(userId: string, leagueId: string, playerId: string) {
    const { teamId } = await this.resolve(userId, leagueId);
    await this.prisma.playerInsurance.deleteMany({ where: { fantasyTeamId: teamId, playerId } });
    return { playerId, cancelled: true };
  }

  async getInsurances(userId: string, leagueId: string) {
    const { teamId } = await this.resolve(userId, leagueId);
    const policies = await this.prisma.playerInsurance.findMany({
      where: { fantasyTeamId: teamId },
      include: { player: { select: { id: true, name: true } } },
    });
    return policies.map((p) => ({ playerId: p.playerId, playerName: p.player.name, tier: p.tier, bonus: INSURANCE[p.tier as InsuranceTier].bonus }));
  }

  /** Cobra la parte proporcional (anual/38) de cada seguro. Idempotente por jornada. */
  async chargeInsurancePremiums(gameweekId: string): Promise<number> {
    const already = await this.prisma.transaction.count({ where: { gameweekId, type: "INSURANCE" } });
    if (already > 0) return 0;
    const gw = await this.prisma.gameweek.findUnique({ where: { id: gameweekId }, select: { seasonId: true } });
    if (!gw) return 0;

    const teams = await this.prisma.fantasyTeam.findMany({
      where: { membership: { league: { seasonId: gw.seasonId } }, insurances: { some: {} } },
      select: { id: true, insurances: { select: { tier: true } } },
    });
    let charged = 0;
    for (const t of teams) {
      const premium = t.insurances.reduce((s, p) => s + Math.round(INSURANCE[p.tier as InsuranceTier].annualCost / SEASON_GAMEWEEKS), 0);
      if (premium <= 0) continue;
      await this.prisma.$transaction([
        this.prisma.fantasyTeam.update({ where: { id: t.id }, data: { budget: { decrement: premium } } }),
        this.prisma.transaction.create({
          data: { fantasyTeamId: t.id, type: "INSURANCE", amount: -premium, gameweekId, description: "Seguro médico (prorrateo)" },
        }),
      ]);
      charged++;
    }
    return charged;
  }
}
