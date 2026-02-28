import nodemailer from "nodemailer";
import type { AppEnv } from "../lib/env.js";

export class MailerService {
  private readonly transporter;

  constructor(private readonly env: AppEnv) {
    this.transporter = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        })
      : null;
  }

  isConfigured(): boolean {
    return Boolean(this.transporter && this.env.SMTP_FROM_EMAIL);
  }

  async send(options: { to: string; subject: string; text: string; html?: string }): Promise<{ messageId?: string; simulated: boolean }> {
    if (!this.transporter || !this.env.SMTP_FROM_EMAIL) {
      return { simulated: true };
    }

    const info = await this.transporter.sendMail({
      from: {
        address: this.env.SMTP_FROM_EMAIL,
        name: this.env.SMTP_FROM_NAME
      },
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });

    return {
      messageId: info.messageId,
      simulated: false
    };
  }
}
