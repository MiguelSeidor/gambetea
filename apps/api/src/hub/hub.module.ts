import { Module } from "@nestjs/common";
import { HubSyncService } from "./hub-sync.service";
import { PlayerLifecycleService } from "./player-lifecycle.service";

@Module({
  providers: [PlayerLifecycleService, HubSyncService],
  exports: [PlayerLifecycleService, HubSyncService],
})
export class HubModule {}
