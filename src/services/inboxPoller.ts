import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { AppEnv } from "../lib/env.js";
import { classifyReply } from "./replyClassifier.js";
import { OutreachRepository } from "../db/repositories/outreachRepository.js";
import { DossierRepository } from "../db/repositories/dossierRepository.js";
import { VenueRepository } from "../db/repositories/venueRepository.js";

export class InboxPoller {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly env: AppEnv,
    private readonly outreachRepository: OutreachRepository,
    private readonly dossierRepository: DossierRepository,
    private readonly venueRepository: VenueRepository
  ) {}

  start(): void {
    if (!this.env.IMAP_HOST || !this.env.IMAP_USER || !this.env.IMAP_PASS) {
      return;
    }
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, 30000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollOnce(): Promise<void> {
    if (!this.env.IMAP_HOST || !this.env.IMAP_USER || !this.env.IMAP_PASS) {
      return;
    }

    const client = new ImapFlow({
      host: this.env.IMAP_HOST,
      port: this.env.IMAP_PORT,
      secure: this.env.IMAP_SECURE,
      auth: {
        user: this.env.IMAP_USER,
        pass: this.env.IMAP_PASS
      }
    });

    try {
      await client.connect();
      await client.mailboxOpen("INBOX");
      for await (const message of client.fetch("1:*", { envelope: true, source: true, flags: true })) {
        if (message.flags?.has("\\Seen")) {
          continue;
        }
        const parsed = await simpleParser(message.source ?? Buffer.from("")) as ParsedMail;
        const from = parsed.from?.value[0]?.address;
        if (!from) {
          continue;
        }

        const threads = this.outreachRepository.listThreads();
        const thread = threads.find((item) => (item.subject ?? "").toLowerCase() === (parsed.subject ?? "").toLowerCase());
        if (!thread) {
          continue;
        }

        const intent = classifyReply(parsed.text ?? "");
        this.outreachRepository.addMessage({
          threadId: thread.id,
          direction: "inbound",
          providerMessageId: message.envelope?.messageId ?? undefined,
          inReplyTo: parsed.inReplyTo ?? undefined,
          subject: parsed.subject ?? undefined,
          bodyText: parsed.text ?? "",
          bodyHtml: parsed.html ? String(parsed.html) : undefined,
          status: "received",
          classificationJson: JSON.stringify({ intent, from }),
          receivedAt: new Date().toISOString()
        });
        this.outreachRepository.updateThread(thread.id, {
          status: intent === "interested" ? "interested" : intent === "not_now" ? "not_now" : intent === "unsubscribe" ? "unsubscribed" : "replied",
          replyIntent: intent,
          lastMessageAt: new Date().toISOString()
        });
        const venue = this.venueRepository.getVenueByIdOrSlug(thread.venueId);
        this.dossierRepository.append({
          venueId: venue?.id ?? thread.venueId,
          stage: "reply_ingestion",
          eventType: "reply_classified",
          decision: intent,
          details: { from, subject: parsed.subject ?? "", bodyText: parsed.text ?? "" }
        });
        if (intent === "unsubscribe") {
          this.outreachRepository.addSuppression(from, "reply_unsubscribe");
        }
        await client.messageFlagsAdd(message.uid, ["\\Seen"]);
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}
