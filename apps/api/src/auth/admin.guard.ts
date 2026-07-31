import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "./current-user.decorator";

/**
 * Exige rol de administrador GLOBAL (ADR-016). Va SIEMPRE tras `JwtAuthGuard`, que ya inyecta
 * `req.user` (con `isAdmin`). No autentica; sólo autoriza.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user?.isAdmin) throw new ForbiddenException("Requiere rol de administrador");
    return true;
  }
}
