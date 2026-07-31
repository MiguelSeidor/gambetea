import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BidDto } from "./dto/bid.dto";
import { MarketService } from "./market.service";

@UseGuards(JwtAuthGuard)
@Controller("leagues/:leagueId")
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get("market")
  market_(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.market.getMarket(user.id, leagueId);
  }

  @Post("market/listings/:listingId/bids")
  @HttpCode(200)
  bid(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("listingId") listingId: string,
    @Body() dto: BidDto,
  ) {
    return this.market.placeBid(user.id, leagueId, listingId, dto.amount);
  }

  @Post("market/clause/:playerId")
  @HttpCode(200)
  clause(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("playerId") playerId: string,
  ) {
    return this.market.payClause(user.id, leagueId, playerId);
  }

  @Post("team/players/:playerId/sell")
  @HttpCode(200)
  sell(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("playerId") playerId: string,
  ) {
    return this.market.sellPlayer(user.id, leagueId, playerId);
  }

  @Get("players")
  leaguePlayers(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.market.getLeaguePlayers(user.id, leagueId);
  }

  @Post("team/players/:playerId/list")
  @HttpCode(200)
  list(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("playerId") playerId: string,
    @Body() dto: { askingPrice: number },
  ) {
    return this.market.listPlayer(user.id, leagueId, playerId, dto.askingPrice);
  }

  @Post("team/players/:playerId/unlist")
  @HttpCode(200)
  unlist(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("playerId") playerId: string,
  ) {
    return this.market.unlistPlayer(user.id, leagueId, playerId);
  }

  @Get("transactions")
  transactions(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.market.getTransactions(user.id, leagueId);
  }
}

/**
 * Operaciones de mercado de administrador (generar/resolver ronda, revalorar).
 * PROVISIONAL: solo JWT; la autorización de admin real llega en el Sprint 15.
 */
@UseGuards(JwtAuthGuard)
@Controller("admin/leagues/:leagueId")
export class AdminMarketController {
  constructor(private readonly market: MarketService) {}

  @Post("market/generate")
  @HttpCode(200)
  generate(@Param("leagueId") leagueId: string) {
    return this.market.generateListings(leagueId);
  }

  @Post("market/resolve")
  @HttpCode(200)
  resolve(@Param("leagueId") leagueId: string) {
    return this.market.resolveMarket(leagueId);
  }

  @Post("valuations/refresh")
  @HttpCode(200)
  refresh(@Param("leagueId") leagueId: string) {
    return this.market.refreshValuations(leagueId);
  }
}
