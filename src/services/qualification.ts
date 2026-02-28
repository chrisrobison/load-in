import type { ContactRecord, QualificationDecision } from "../types.js";
import type { AppEnv } from "../lib/env.js";

export class QualificationService {
  constructor(private readonly env: AppEnv) {}

  decide(score: number, topLeakSeverity: number | undefined, contacts: ContactRecord[], hasSuppression: boolean, contactedRecently: boolean): QualificationDecision {
    const primaryContact = contacts.find((contact) => contact.isPrimary && contact.kind !== "phone") ?? contacts.find((contact) => contact.kind !== "phone");
    const rationale: string[] = [];

    if (score >= this.env.QUALIFICATION_MIN_SCORE) {
      rationale.push(`Score ${score} meets the qualification threshold of ${this.env.QUALIFICATION_MIN_SCORE}.`);
    } else {
      rationale.push(`Score ${score} is below the qualification threshold of ${this.env.QUALIFICATION_MIN_SCORE}.`);
    }

    if ((topLeakSeverity ?? 0) >= this.env.QUALIFICATION_MIN_SEVERITY) {
      rationale.push(`Top leak severity ${(topLeakSeverity ?? 0)} meets the minimum severity threshold of ${this.env.QUALIFICATION_MIN_SEVERITY}.`);
    } else {
      rationale.push(`Top leak severity ${(topLeakSeverity ?? 0)} is below the minimum severity threshold of ${this.env.QUALIFICATION_MIN_SEVERITY}.`);
    }

    if (primaryContact) {
      rationale.push(`Primary contact ${primaryContact.value} has confidence ${primaryContact.confidence.toFixed(2)}.`);
    } else {
      rationale.push("No non-phone contact was found.");
    }

    if (hasSuppression) {
      rationale.push("Primary contact is suppressed.");
    }
    if (contactedRecently) {
      rationale.push(`Venue has already been contacted in the last ${this.env.AUTO_SEND_COOLDOWN_DAYS} days.`);
    }

    const qualified = score >= this.env.QUALIFICATION_MIN_SCORE
      && (topLeakSeverity ?? 0) >= this.env.QUALIFICATION_MIN_SEVERITY
      && Boolean(primaryContact);
    const autoSendEligible = qualified
      && this.env.AUTO_SEND_ENABLED
      && Boolean(primaryContact?.kind === "email")
      && Boolean(primaryContact && primaryContact.confidence >= this.env.AUTO_SEND_MIN_CONTACT_CONFIDENCE)
      && !hasSuppression
      && !contactedRecently;

    return {
      qualified,
      autoSendEligible,
      reason: qualified
        ? autoSendEligible ? "qualified_auto-send" : "qualified_manual_or_env_gate"
        : "disqualified",
      rationale,
      scoreThreshold: this.env.QUALIFICATION_MIN_SCORE,
      minLeakSeverity: this.env.QUALIFICATION_MIN_SEVERITY
    };
  }
}
