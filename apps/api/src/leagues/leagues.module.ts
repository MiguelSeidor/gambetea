import { Module } from "@nestjs/common";
import { FantasyModule } from "../fantasy/fantasy.module";
import { LeaguesController } from "./leagues.controller";
import { LeaguesService } from "./leagues.service";

@Module({
  imports: [FantasyModule],
  controllers: [LeaguesController],
  providers: [LeaguesService],
})
export class LeaguesModule {}
