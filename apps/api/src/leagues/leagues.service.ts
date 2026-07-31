import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FantasyTeamService } from "../fantasy/fantasy-team.service";
import { COACH_CRITERIA, mergeCoachConfig } from "../scoring/coach.rules";
import { PLAYER_CRITERIA, mergePlayerConfig } from "../scoring/player.rules";
import { CreateLeagueDto } from "./dto/create-league.dto";
import { JoinLeagueDto } from "./dto/join-league.dto";

// Alfabeto sin caracteres ambiguos (0/O, 1/I) para códigos legibles de viva voz.
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 6;

@Injectable()
export class LeaguesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fantasy: FantasyTeamService,
  ) {}

  /** Crea una liga privada en la temporada activa; el creador queda como OWNER. */
  async create(userId: string, dto: CreateLeagueDto) {
    const season = await this.prisma.season.findFirst({ where: { current: true } });
    if (!season) {
      throw new BadRequestException("No hay una temporada activa configurada");
    }
    const inviteCode = await this.uniqueInviteCode();
    const league = await this.prisma.league.create({
      data: {
        name: dto.name,
        seasonId: season.id,
        ownerId: userId,
        inviteCode,
        settings: { create: {} }, // defaults recomendados (ADR-014)
        memberships: {
          create: {
            userId,
            role: "OWNER",
            fantasyTeam: { create: { name: dto.teamName ?? "Mi equipo", budget: 0 } },
          },
        },
      },
      include: { memberships: { include: { fantasyTeam: true } } },
    });
    const team = league.memberships[0]?.fantasyTeam;
    if (team) await this.fantasy.initialize(team.id, season.id);
    return this.getOne(userId, league.id);
  }

  /** Une al usuario a una liga existente mediante código de invitación. */
  async join(userId: string, dto: JoinLeagueDto) {
    const code = dto.inviteCode.toUpperCase();
    const league = await this.prisma.league.findUnique({ where: { inviteCode: code } });
    if (!league) {
      throw new NotFoundException("Código de invitación no válido");
    }
    const existing = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId } },
    });
    if (existing) {
      throw new ConflictException("Ya eres miembro de esta liga");
    }
    const membership = await this.prisma.leagueMembership.create({
      data: {
        leagueId: league.id,
        userId,
        role: "MEMBER",
        fantasyTeam: { create: { name: dto.teamName ?? "Mi equipo", budget: 0 } },
      },
      include: { fantasyTeam: true },
    });
    if (membership.fantasyTeam) {
      await this.fantasy.initialize(membership.fantasyTeam.id, league.seasonId);
    }
    return this.getOne(userId, league.id);
  }

  /** Ligas a las que pertenece el usuario, con recuento de miembros. */
  async listMine(userId: string) {
    const memberships = await this.prisma.leagueMembership.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      include: {
        league: {
          include: {
            season: { include: { competition: true } },
            _count: { select: { memberships: true } },
          },
        },
      },
    });
    return memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      role: m.role,
      inviteCode: m.league.inviteCode,
      memberCount: m.league._count.memberships,
      season: m.league.season.name,
      competition: m.league.season.competition.name,
    }));
  }

  /** Detalle de una liga (solo si el usuario es miembro), con lista de miembros. */
  async getOne(userId: string, leagueId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        season: { include: { competition: true } },
        memberships: {
          orderBy: { joinedAt: "asc" },
          include: {
            user: { select: { id: true, displayName: true } },
            fantasyTeam: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!league) {
      throw new NotFoundException("Liga no encontrada");
    }
    const me = league.memberships.find((m) => m.userId === userId);
    if (!me) {
      throw new ForbiddenException("No perteneces a esta liga");
    }
    return {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      role: me.role,
      season: league.season.name,
      competition: league.season.competition.name,
      members: league.memberships.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        teamId: m.fantasyTeam?.id ?? null,
        teamName: m.fantasyTeam?.name ?? null,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /** Jornadas del juego para la liga, mapeadas a los datos reales (partidos por jornada). */
  async gameweeks(userId: string, leagueId: string) {
    const membership = await this.assertMember(userId, leagueId);
    const gameweeks = await this.prisma.gameweek.findMany({
      where: { season: { leagues: { some: { id: membership.leagueId } } } },
      orderBy: { number: "asc" },
      include: { _count: { select: { matches: true } } },
    });
    return gameweeks.map((g) => ({
      id: g.id,
      number: g.number,
      deadline: g.deadline,
      status: g.status,
      matches: g._count.matches,
    }));
  }

  /** Feed de noticias del campeonato (traspasos, jubilaciones, altas, cambios) — ADR-018. */
  async news(userId: string, leagueId: string) {
    const membership = await this.assertMember(userId, leagueId);
    const league = await this.prisma.league.findUnique({ where: { id: membership.leagueId }, select: { seasonId: true } });
    if (!league) return [];
    const rows = await this.prisma.playerEvent.findMany({
      where: { seasonId: league.seasonId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((e) => ({
      id: e.id,
      type: e.type,
      playerName: e.playerName,
      from: e.fromLabel,
      to: e.toLabel,
      createdAt: e.createdAt,
    }));
  }

  /** Partidos reales de una jornada (local vs visitante, resultado si jugado). */
  async gameweekMatches(userId: string, leagueId: string, gameweekId: string) {
    await this.assertMember(userId, leagueId);
    const matches = await this.prisma.match.findMany({
      where: { gameweekId },
      orderBy: { kickoff: "asc" },
      select: {
        id: true,
        kickoff: true,
        status: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
    });
    return matches.map((m) => ({
      id: m.id,
      kickoff: m.kickoff,
      status: m.status,
      home: m.homeTeam.name,
      homeShort: m.homeTeam.shortName,
      away: m.awayTeam.name,
      awayShort: m.awayTeam.shortName,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
    }));
  }

  /** Config económica de la liga (la ven los miembros). Crea defaults si falta (ADR-014). */
  async getSettings(userId: string, leagueId: string) {
    await this.assertMember(userId, leagueId);
    let settings = await this.prisma.leagueSettings.findUnique({ where: { leagueId } });
    if (!settings) settings = await this.prisma.leagueSettings.create({ data: { leagueId } });
    return settings;
  }

  /** Actualiza la config (solo el creador/OWNER de la liga). */
  async updateSettings(userId: string, leagueId: string, dto: Record<string, number>) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } });
    if (!league) throw new NotFoundException("Liga no encontrada");
    if (league.ownerId !== userId) throw new ForbiddenException("Solo el creador de la liga puede cambiar la configuración");
    return this.prisma.leagueSettings.upsert({
      where: { leagueId },
      create: { leagueId, ...dto },
      update: { ...dto },
    });
  }

  /** Catálogo de criterios de entrenador con el estado (activo/valor) de esta liga. */
  async getCoachCriteria(userId: string, leagueId: string) {
    await this.assertMember(userId, leagueId);
    const settings = await this.prisma.leagueSettings.findUnique({ where: { leagueId }, select: { coachCriteria: true } });
    const config = mergeCoachConfig(settings?.coachCriteria);
    return COACH_CRITERIA.map((c) => ({
      key: c.key,
      label: c.label,
      enabled: config[c.key].enabled,
      value: config[c.key].value,
      default: c.value,
    }));
  }

  /** Actualiza el baremo de entrenador de la liga (solo el creador). */
  async updateCoachCriteria(userId: string, leagueId: string, overrides: Record<string, { enabled?: boolean; value?: number }>) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } });
    if (!league) throw new NotFoundException("Liga no encontrada");
    if (league.ownerId !== userId) throw new ForbiddenException("Solo el creador puede cambiar el baremo");
    const valid = new Set(COACH_CRITERIA.map((c) => c.key));
    const clean: Record<string, { enabled: boolean; value: number }> = {};
    for (const [k, v] of Object.entries(overrides ?? {})) {
      if (valid.has(k) && v) clean[k] = { enabled: !!v.enabled, value: Math.round(Number(v.value) || 0) };
    }
    await this.prisma.leagueSettings.upsert({
      where: { leagueId },
      create: { leagueId, coachCriteria: clean },
      update: { coachCriteria: clean },
    });
    return this.getCoachCriteria(userId, leagueId);
  }

  /** Catálogo de criterios de JUGADOR con el estado (activo/valor) de esta liga (ADR-015). */
  async getPlayerCriteria(userId: string, leagueId: string) {
    await this.assertMember(userId, leagueId);
    const settings = await this.prisma.leagueSettings.findUnique({ where: { leagueId }, select: { playerCriteria: true } });
    const config = mergePlayerConfig(settings?.playerCriteria);
    return PLAYER_CRITERIA.map((c) => ({
      key: c.key,
      label: c.label,
      scope: c.scope,
      enabled: config[c.key].enabled,
      value: config[c.key].value,
      default: c.value,
      raw: c.raw ?? false,
    }));
  }

  /** Actualiza el baremo de jugador de la liga (solo el creador). */
  async updatePlayerCriteria(userId: string, leagueId: string, overrides: Record<string, { enabled?: boolean; value?: number }>) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } });
    if (!league) throw new NotFoundException("Liga no encontrada");
    if (league.ownerId !== userId) throw new ForbiddenException("Solo el creador puede cambiar el baremo");
    const valid = new Set(PLAYER_CRITERIA.map((c) => c.key));
    const clean: Record<string, { enabled: boolean; value: number }> = {};
    for (const [k, v] of Object.entries(overrides ?? {})) {
      if (valid.has(k) && v) clean[k] = { enabled: !!v.enabled, value: Math.round(Number(v.value) || 0) };
    }
    await this.prisma.leagueSettings.upsert({
      where: { leagueId },
      create: { leagueId, playerCriteria: clean },
      update: { playerCriteria: clean },
    });
    return this.getPlayerCriteria(userId, leagueId);
  }

  private async assertMember(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException("No perteneces a esta liga");
    }
    return membership;
  }

  private async uniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = "";
      for (let i = 0; i < INVITE_LENGTH; i++) {
        code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
      }
      const clash = await this.prisma.league.findUnique({ where: { inviteCode: code } });
      if (!clash) return code;
    }
    throw new Error("No se pudo generar un código de invitación único");
  }
}
