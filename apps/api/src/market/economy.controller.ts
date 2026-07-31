import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { IsInt, IsIn, Min } from "class-validator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EconomyService } from "./economy.service";
import type { InsuranceTier } from "./economy.rules";

class LoanDto {
  @IsInt()
  @Min(1)
  amount!: number;
}

class InsuranceDto {
  @IsIn(["BASIC", "MEDIUM", "ADVANCED"])
  tier!: InsuranceTier;
}

@UseGuards(JwtAuthGuard)
@Controller("leagues/:leagueId")
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  @Post("loans")
  @HttpCode(200)
  takeLoan(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string, @Body() dto: LoanDto) {
    return this.economy.takeLoan(user.id, leagueId, dto.amount);
  }

  @Get("loans")
  loans(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.economy.getLoans(user.id, leagueId);
  }

  @Post("team/players/:playerId/insurance")
  @HttpCode(200)
  insure(
    @CurrentUser() user: AuthUser,
    @Param("leagueId") leagueId: string,
    @Param("playerId") playerId: string,
    @Body() dto: InsuranceDto,
  ) {
    return this.economy.contractInsurance(user.id, leagueId, playerId, dto.tier);
  }

  @Delete("team/players/:playerId/insurance")
  cancelInsurance(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string, @Param("playerId") playerId: string) {
    return this.economy.cancelInsurance(user.id, leagueId, playerId);
  }

  @Get("insurances")
  insurances(@CurrentUser() user: AuthUser, @Param("leagueId") leagueId: string) {
    return this.economy.getInsurances(user.id, leagueId);
  }
}
