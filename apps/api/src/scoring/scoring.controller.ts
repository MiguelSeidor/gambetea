import { Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ScoringService } from "./scoring.service";

/**
 * Operaciones de ciclo de jornada. PROVISIONAL: protegidas solo con JWT; la autorización
 * de administrador real llega en el Sprint 15 (endurecimiento).
 */
@UseGuards(JwtAuthGuard)
@Controller("admin/gameweeks")
export class AdminGameweekController {
  constructor(private readonly scoring: ScoringService) {}

  @Post(":id/lock")
  @HttpCode(200)
  lock(@Param("id") id: string) {
    return this.scoring.lockGameweek(id);
  }

  @Post(":id/compute")
  @HttpCode(200)
  compute(@Param("id") id: string) {
    return this.scoring.computeGameweek(id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller("leagues/:leagueId")
export class LeagueScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Get("standings")
  standings(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.scoring.getStandings(user.id, leagueId);
  }

  @Get("team/gameweeks")
  teamGameweeks(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.scoring.getTeamGameweeks(user.id, leagueId);
  }

  @Get("team/gameweek/:gameweekId")
  teamGameweek(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("gameweekId") gameweekId: string,
  ) {
    return this.scoring.getTeamGameweek(user.id, leagueId, gameweekId);
  }
}
