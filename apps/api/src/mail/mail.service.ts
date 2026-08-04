import { Injectable, Logger } from "@nestjs/common";

// Envío de email. Usa Resend (https://resend.com) si hay RESEND_API_KEY; si no, en desarrollo
// registra el contenido en el log (para poder probar sin proveedor de correo). Sin dependencias
// extra: llamada HTTP directa.
@Injectable()
export class MailService {
  private readonly log = new Logger("Mail");

  get configured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM ?? "Gambetea <onboarding@resend.dev>";
    if (!key) {
      this.log.warn(`[DEV] Sin RESEND_API_KEY: email NO enviado a ${to} · asunto "${subject}"`);
      return;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) this.log.error(`Resend ${res.status}: ${await res.text()}`);
    } catch (e) {
      this.log.error(`Error enviando email: ${(e as Error).message}`);
    }
  }
}
