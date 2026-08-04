import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { LeaguesModule } from "./leagues/leagues.module";
import { FantasyModule } from "./fantasy/fantasy.module";
import { ScoringModule } from "./scoring/scoring.module";
import { MarketModule } from "./market/market.module";
import { StadiumModule } from "./stadium/stadium.module";
import { TasksModule } from "./tasks/tasks.module";
import { AdminModule } from "./admin/admin.module";
import { HubModule } from "./hub/hub.module";
import { MailModule } from "./mail/mail.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    LeaguesModule,
    FantasyModule,
    ScoringModule,
    MarketModule,
    StadiumModule,
    TasksModule,
    AdminModule,
    HubModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
