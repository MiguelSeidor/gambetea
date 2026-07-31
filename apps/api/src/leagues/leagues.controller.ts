import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateLeagueDto } from "./dto/create-league.dto";
import { JoinLeagueDto } from "./dto/join-league.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { LeaguesService } from "./leagues.service";

@UseGuards(JwtAuthGuard)
@Controller("leagues")
export class LeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeagueDto) {
    return this.leagues.create(user.id, dto);
  }

  @Post("join")
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinLeagueDto) {
    return this.leagues.join(user.id, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.leagues.listMine(user.id);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leagues.getOne(user.id, id);
  }

  @Get(":id/gameweeks")
  gameweeks(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leagues.gameweeks(user.id, id);
  }

  @Get(":id/gameweeks/:gwId/matches")
  gameweekMatches(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("gwId") gwId: string) {
    return this.leagues.gameweekMatches(user.id, id, gwId);
  }

  @Get(":id/news")
  news(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leagues.news(user.id, id);
  }

  @Get(":id/settings")
  getSettings(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leagues.getSettings(user.id, id);
  }

  @Patch(":id/settings")
  updateSettings(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateSettingsDto) {
    return this.leagues.updateSettings(user.id, id, dto as unknown as Record<string, number>);
  }

  @Get(":id/coach-criteria")
  coachCriteria(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leagues.getCoachCriteria(user.id, id);
  }

  @Patch(":id/coach-criteria")
  updateCoachCriteria(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: Record<string, { enabled?: boolean; value?: number }>,
  ) {
    return this.leagues.updateCoachCriteria(user.id, id, body);
  }

  @Get(":id/player-criteria")
  playerCriteria(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leagues.getPlayerCriteria(user.id, id);
  }

  @Patch(":id/player-criteria")
  updatePlayerCriteria(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: Record<string, { enabled?: boolean; value?: number }>,
  ) {
    return this.leagues.updatePlayerCriteria(user.id, id, body);
  }
}
