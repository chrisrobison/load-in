import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  APP_BASE_URL: z.string().default("http://localhost:3030"),
  AUTO_SEND_ENABLED: z.coerce.boolean().default(false),
  AUTO_SEND_MIN_SCORE: z.coerce.number().default(65),
  AUTO_SEND_MIN_CONTACT_CONFIDENCE: z.coerce.number().default(0.75),
  AUTO_SEND_COOLDOWN_DAYS: z.coerce.number().default(21),
  QUALIFICATION_MIN_SCORE: z.coerce.number().default(55),
  QUALIFICATION_MIN_SEVERITY: z.coerce.number().default(10),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Autonomous Fixer"),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: z.coerce.boolean().default(true),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = EnvSchema.parse(process.env);
  }
  return cachedEnv;
}

export function getDatabasePath(): string {
  return path.resolve(process.cwd(), "data", "autonomous_fixer.sqlite");
}
