import { Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StadiumService } from "./stadium.service";

@UseGuards(JwtAuthGuard)
@Controller("leagues/:leagueId/stadium")
export class StadiumController {
  constructor(private readonly stadium: StadiumService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.stadium.getStadium(user.id, leagueId);
  }

  @Post("upgrade")
  @HttpCode(200)
  upgrade(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.stadium.upgrade(user.id, leagueId);
  }

  @Get("boards")
  boards(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.stadium.getBoards(user.id, leagueId);
  }

  @Post("boards/offers")
  @HttpCode(200)
  generateOffers(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.stadium.generateOffers(user.id, leagueId);
  }

  @Post("boards/offers/:offerId/accept")
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string, @Param("offerId") offerId: string) {
    return this.stadium.acceptOffer(user.id, leagueId, offerId);
  }
}
