import { Module } from "@nestjs/common";
import { MarketModule } from "../market/market.module";
import { FantasyController, FantasyRulesController } from "./fantasy.controller";
import { FantasyTeamService } from "./fantasy-team.service";

@Module({
  imports: [MarketModule],
  controllers: [FantasyController, FantasyRulesController],
  providers: [FantasyTeamService],
  exports: [FantasyTeamService],
})
export class FantasyModule {}
