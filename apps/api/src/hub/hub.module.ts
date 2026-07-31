import { Module } from "@nestjs/common";
import { PlayerLifecycleService } from "./player-lifecycle.service";

@Module({
  providers: [PlayerLifecycleService],
  exports: [PlayerLifecycleService],
})
export class HubModule {}
