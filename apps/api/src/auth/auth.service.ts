import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  private readonly log = new Logger("Auth");

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException("Ese correo ya está registrado");
    const passwordHash = bcrypt.hashSync(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });
    return this.sign(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !bcrypt.compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException("Credenciales incorrectas");
    }
    return this.sign(user);
  }

  // === Recuperación de contraseña =============================================

  /** Genera un token de reseteo y envía el email. Responde igual exista o no la cuenta. */
  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await this.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      const base = process.env.WEB_URL ?? "http://localhost:3000";
      const url = `${base}/reset?token=${token}`;
      await this.mail.send(
        user.email,
        "Recupera tu contraseña · Gambetea",
        `<div style="font-family:sans-serif;max-width:480px">
          <h2>Recupera tu contraseña</h2>
          <p>Hola ${user.displayName}, pulsa el botón para elegir una nueva contraseña. El enlace caduca en 1 hora.</p>
          <p><a href="${url}" style="display:inline-block;background:#ff5a1f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Cambiar contraseña</a></p>
          <p style="color:#888;font-size:12px">Si no lo has pedido, ignora este correo.</p>
        </div>`,
      );
      // En dev (sin proveedor de correo) dejamos el enlace en el log para poder probar.
      if (!this.mail.configured) this.log.warn(`[DEV] Enlace de reseteo para ${user.email}: ${url}`);
    }
    return { ok: true };
  }

  /** Cambia la contraseña usando un token válido y no usado. */
  async resetPassword(token: string, password: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const pr = await this.prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (!pr || pr.usedAt || pr.expiresAt < new Date()) {
      throw new BadRequestException("El enlace no es válido o ha caducado. Solicita uno nuevo.");
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: pr.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } }),
      // Invalida cualquier otro token pendiente del usuario.
      this.prisma.passwordReset.updateMany({ where: { userId: pr.userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  private sign(user: { id: string; email: string; displayName: string; isAdmin?: boolean }) {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return {
      accessToken,
      user: { id: user.id, email: user.email, displayName: user.displayName, isAdmin: !!user.isAdmin },
    };
  }
}
