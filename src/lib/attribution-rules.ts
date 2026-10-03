import type { LeadSource } from "./types";

// Lead attribution shared by the proxy (which sets the cookie) and the server (which reads it).
// Share links carry ?src=<channel>; the most recent valid tag wins.

export const LEAD_SOURCES: LeadSource[] = ["INSTAGRAM", "WHATSAPP", "FACEBOOK", "NEWSPAPER", "QR", "SITE"];
export const LEAD_SOURCE_COOKIE = "cn_src";
export const LEAD_SOURCE_MAX_AGE = 60 * 60 * 24 * 30; // seconds

// "Instagram", "instagram" and "INSTAGRAM" all give INSTAGRAM; anything else gives undefined.
export function parseLeadSource(value: string | null | undefined): LeadSource | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.trim().toUpperCase();
  return LEAD_SOURCES.find((s) => s === upper);
}
