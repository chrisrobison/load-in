import type { ReplyIntent } from "../types.js";

export function classifyReply(text: string): ReplyIntent {
  const lower = text.toLowerCase();
  if (/(unsubscribe|remove me|stop emailing)/i.test(lower)) {
    return "unsubscribe";
  }
  if (/(wrong person|wrong contact|not the right)/i.test(lower)) {
    return "wrong_contact";
  }
  if (/(interested|let'?s talk|looks good|send the link|send payment|yes)/i.test(lower)) {
    return "interested";
  }
  if (/(not now|maybe later|circle back|follow up next)/i.test(lower)) {
    return "not_now";
  }
  if (/(question|\?)/i.test(lower)) {
    return "question";
  }
  if (/(delivery failed|undeliverable|mailbox unavailable|bounce)/i.test(lower)) {
    return "bounced";
  }
  return "unknown";
}
