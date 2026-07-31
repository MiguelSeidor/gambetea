import { Controller, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SchedulerService } from "./scheduler.service";

/**
 * Disparo MANUAL del tick diario (dev / fast-forward). En producción el ciclo lo lanza el
 * cron a las 06:00 (ADR-010); este endpoint solo sirve para probar/avanzar a demanda.
 */
@UseGuards(JwtAuthGuard)
@Controller("admin/tick")
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Post()
  @HttpCode(200)
  run(@Query("force") force?: string) {
    const forced = force !== "0" && force !== "false"; // por defecto fuerza (avanzar a demanda)
    return this.scheduler.runDailyTick(forced);
  }
}
