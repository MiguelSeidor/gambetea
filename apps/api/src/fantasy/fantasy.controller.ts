import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SaveLineupDto } from "./dto/save-lineup.dto";
import { FantasyTeamService } from "./fantasy-team.service";
import { FORMATIONS, SQUAD_COMPOSITION, SQUAD_SIZE } from "./fantasy.rules";
import { INSURANCE, SEASON_GAMEWEEKS, type InsuranceTier } from "../market/economy.rules";

@UseGuards(JwtAuthGuard)
@Controller("leagues/:leagueId/team")
export class FantasyController {
  constructor(private readonly fantasy: FantasyTeamService) {}

  @Get()
  getTeam(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.fantasy.getTeam(user.id, leagueId);
  }

  @Get("lineup")
  getLineup(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Query("gameweek") gameweekId?: string,
  ) {
    return this.fantasy.getLineup(user.id, leagueId, gameweekId);
  }

  @Put("lineup")
  saveLineup(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Body() dto: SaveLineupDto,
  ) {
    return this.fantasy.saveLineup(user.id, leagueId, dto);
  }
}

/** Reglas estáticas del juego, útiles para el frontend. */
@Controller("fantasy")
export class FantasyRulesController {
  @Get("rules")
  rules() {
    // El seguro se cobra prorrateado por jornada (anual/38). Exponemos ambas cifras para que
    // el frontend muestre el coste real de cada nivel (fuente única de verdad: economy.rules).
    const insurance = (Object.keys(INSURANCE) as InsuranceTier[]).map((tier) => ({
      tier,
      bonus: INSURANCE[tier].bonus,
      annualCost: INSURANCE[tier].annualCost,
      perGameweek: Math.round(INSURANCE[tier].annualCost / SEASON_GAMEWEEKS),
    }));
    return { squadSize: SQUAD_SIZE, composition: SQUAD_COMPOSITION, formations: FORMATIONS, insurance };
  }
}
