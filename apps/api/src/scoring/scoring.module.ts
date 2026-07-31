import { Module } from "@nestjs/common";
import { AdminGameweekController, LeagueScoringController } from "./scoring.controller";
import { CoachScoringService } from "./coach-scoring.service";
import { ScoringService } from "./scoring.service";

@Module({
  controllers: [AdminGameweekController, LeagueScoringController],
  providers: [ScoringService, CoachScoringService],
  exports: [ScoringService, CoachScoringService],
})
export class ScoringModule {}
