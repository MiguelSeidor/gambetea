import { Module } from "@nestjs/common";
import { AdminMarketController, MarketController } from "./market.controller";
import { EconomyController } from "./economy.controller";
import { EconomyService } from "./economy.service";
import { MarketService } from "./market.service";
import { ValuationService } from "./valuation.service";

@Module({
  controllers: [MarketController, AdminMarketController, EconomyController],
  providers: [MarketService, ValuationService, EconomyService],
  exports: [ValuationService, MarketService, EconomyService],
})
export class MarketModule {}
