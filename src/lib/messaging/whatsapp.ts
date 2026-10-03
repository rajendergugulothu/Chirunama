import "server-only";
import { env } from "@/lib/env";
import type { OutboundMessage, Sender } from "./types";

// WhatsApp Cloud API sender. Used only when both WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID
// are set; otherwise messages stay in the outbox as LOGGED.

type WhatsAppConfig = { token: string; phoneNumberId: string; apiVersion: string };

export function whatsappPayload(message: OutboundMessage): Record<string, unknown> {
  if (!message.template) {
    return { messaging_product: "whatsapp", to: message.to, type: "text", text: { body: message.body } };
  }
  const params = message.params ?? [];
  const components: Record<string, unknown>[] = [
    { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
  ];
  // Authentication templates carry the code again in their copy-code button.
  if (message.purpose === "otp" && params[0]) {
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: params[0] }] });
  }
  return {
    messaging_product: "whatsapp",
    to: message.to,
    type: "template",
    template: {
      name: message.template,
      language: { code: message.language === "EN" ? "en" : "te" },
      components,
    },
  };
}

export function createWhatsAppSender(config: WhatsAppConfig): Sender {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  return {
    async send(message) {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(whatsappPayload(message)),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json().catch(() => null)) as {
        messages?: { id?: string }[];
        error?: { message?: string; code?: number };
      } | null;
      if (!response.ok) {
        const detail = data?.error?.message ?? response.statusText;
        throw new Error(`WhatsApp API ${response.status}: ${detail}${data?.error?.code ? ` (code ${data.error.code})` : ""}`);
      }
      return { providerMessageId: data?.messages?.[0]?.id };
    },
  };
}

// The configured sender, or null when WhatsApp is not set up.
export function whatsappSender(): Sender | null {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION } = env();
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return null;
  return createWhatsAppSender({ token: WHATSAPP_TOKEN, phoneNumberId: WHATSAPP_PHONE_NUMBER_ID, apiVersion: WHATSAPP_API_VERSION });
}
