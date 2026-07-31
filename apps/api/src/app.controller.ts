import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  async health() {
    const [teams, players, matches] = await Promise.all([
      this.prisma.team.count(),
      this.prisma.player.count(),
      this.prisma.match.count(),
    ]);
    return { status: "ok", db: { teams, players, matches } };
  }
}
