import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminService } from "./admin.service";

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("teams/:id")
  team(@Param("id") id: string) {
    return this.admin.teamDetail(id);
  }

  @Get("audit")
  audit() {
    return this.admin.listAudit();
  }

  @Post("teams/:id/money")
  @HttpCode(200)
  money(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() body: { amount: number; reason?: string }) {
    return this.admin.adjustMoney(u.id, id, body.amount, body.reason);
  }

  @Patch("players/:id")
  updatePlayer(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; position?: string; teamId?: string | null; rating?: number; value?: number },
  ) {
    return this.admin.updatePlayer(u.id, id, body);
  }

  @Post("players")
  createPlayer(@CurrentUser() u: AuthUser, @Body() body: { name: string; position: string; teamId: string; rating?: number }) {
    return this.admin.createPlayer(u.id, body);
  }

  @Delete("players/:id")
  deletePlayer(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.admin.deletePlayer(u.id, id);
  }

  @Patch("coaches/:id")
  updateCoach(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() body: { name?: string; value?: number }) {
    return this.admin.updateCoach(u.id, id, body);
  }

  @Post("leagues/:id/reassign")
  @HttpCode(200)
  reassign(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() body: { playerId: string; toTeamId: string; price?: number; adjustMoney?: boolean },
  ) {
    return this.admin.reassignPlayer(u.id, id, body);
  }

  @Post("fantasy-score")
  @HttpCode(200)
  fantasyScore(@CurrentUser() u: AuthUser, @Body() body: { fantasyTeamId: string; gameweekId: string; points: number }) {
    return this.admin.setFantasyScore(u.id, body);
  }

  @Post("gameweeks/:id/recompute")
  @HttpCode(200)
  recompute(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.admin.recomputeGameweek(u.id, id);
  }

  // Ciclo de vida del jugador (ADR-018)
  @Post("players/:id/transfer-out")
  @HttpCode(200)
  transferOut(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.admin.transferOut(u.id, id);
  }

  @Post("players/:id/retire")
  @HttpCode(200)
  retire(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.admin.retirePlayer(u.id, id);
  }

  @Post("players/:id/position")
  @HttpCode(200)
  position(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() body: { position: string }) {
    return this.admin.changePosition(u.id, id, body.position);
  }

  @Post("players/:id/club")
  @HttpCode(200)
  club(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() body: { teamId: string }) {
    return this.admin.changeClub(u.id, id, body.teamId);
  }

  // Gestión del Hub (ADR-019)
  @Get("hub/status")
  hubStatus() {
    return this.admin.hubStatus();
  }

  @Post("hub/reset")
  @HttpCode(200)
  hubReset(@CurrentUser() u: AuthUser) {
    return this.admin.hubReset(u.id);
  }

  @Post("hub/backfill")
  @HttpCode(200)
  hubBackfill(@CurrentUser() u: AuthUser) {
    return this.admin.hubBackfill(u.id);
  }

  @Post("hub/play")
  @HttpCode(200)
  hubPlay(@CurrentUser() u: AuthUser, @Body() body: { count?: number }) {
    return this.admin.hubPlay(u.id, body?.count ?? 1);
  }
}
