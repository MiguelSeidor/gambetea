import { Module } from "@nestjs/common";
import { HubModule } from "../hub/hub.module";
import { ScoringModule } from "../scoring/scoring.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [ScoringModule, HubModule], // ScoringService (recompute) + ciclo de vida del jugador
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
