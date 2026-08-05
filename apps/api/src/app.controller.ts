import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "./prisma/prisma.service";

// Caché en memoria de escudos ya descargados (teamId → imagen). Se repuebla solo tras reiniciar;
// son 20 imágenes pequeñas. Evita golpear el CDN del proveedor en cada carga.
const crestCache = new Map<string, { buf: Buffer; type: string }>();

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

  /**
   * Proxy del escudo de un equipo (Football Data Hub, regla 3): el FRONTEND solo habla con
   * nosotros; nosotros descargamos la imagen del proveedor una vez, la cacheamos y la servimos
   * desde nuestro dominio. Así seguimos pudiendo cambiar de proveedor sin tocar el frontend.
   */
  @Get("teams/:id/crest")
  async crest(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const send = (entry: { buf: Buffer; type: string }) => {
      res.setHeader("Content-Type", entry.type);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable"); // 7 días
      res.end(entry.buf);
    };

    const cached = crestCache.get(id);
    if (cached) return send(cached);

    const team = await this.prisma.team.findUnique({ where: { id }, select: { crestUrl: true } });
    if (!team?.crestUrl) {
      res.status(404).end();
      return;
    }
    try {
      const r = await fetch(team.crestUrl);
      if (!r.ok) {
        res.status(404).end();
        return;
      }
      const entry = { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") ?? "image/png" };
      crestCache.set(id, entry);
      send(entry);
    } catch {
      res.status(404).end();
    }
  }
}
