import { Module } from "@nestjs/common";
import { HubModule } from "../hub/hub.module";
import { MarketModule } from "../market/market.module";
import { ScoringModule } from "../scoring/scoring.module";
import { SchedulerController } from "./scheduler.controller";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [ScoringModule, MarketModule, HubModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class TasksModule {}
