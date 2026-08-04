import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

// Envío de email por SMTP (Gmail, Outlook o cualquier SMTP). No requiere verificar dominios ni
// tocar DNS: basta usuario + contraseña (en Gmail, una "contraseña de aplicación"). Si no hay
// SMTP configurado, en desarrollo se registra el contenido en el log (para probar sin proveedor).
@Injectable()
export class MailService {
  private readonly log = new Logger("Mail");
  private transporter: nodemailer.Transporter | null = null;

  get configured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  private getTransport(): nodemailer.Transporter | null {
    if (!this.configured) return null;
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT ?? "587");
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465, // 465 = SSL directo; 587 = STARTTLS
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }
    return this.transporter;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const t = this.getTransport();
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "Gambetea";
    if (!t) {
      this.log.warn(`[DEV] Sin SMTP configurado: email NO enviado a ${to} · asunto "${subject}"`);
      return;
    }
    try {
      await t.sendMail({ from, to, subject, html });
    } catch (e) {
      this.log.error(`Error enviando email por SMTP: ${(e as Error).message}`);
    }
  }
}
