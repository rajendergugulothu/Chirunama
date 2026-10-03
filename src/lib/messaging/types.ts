// Outgoing WhatsApp and SMS messages. Every message goes through the Outbox table first.

export type MessageChannel = "WHATSAPP" | "SMS";

export type OutboundMessage = {
  channel: MessageChannel;
  to: string; // 91XXXXXXXXXX
  purpose: string; // otp, lead, visit_reminder, saved_search, expiry_reminder
  body: string; // plain-text fallback, and what the outbox viewer shows
  template?: string; // approved WhatsApp template name
  params?: string[]; // template body parameters, in order
  language?: "TE" | "EN";
};

export type Sender = {
  send(message: OutboundMessage): Promise<{ providerMessageId?: string }>;
};
