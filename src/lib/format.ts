import type { Category } from "./types";

// Indian number formatting: ₹12,000 for rents, ₹85 L / ₹1.2 Cr for sale prices.
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatPrice(amount: number, category: Category): string {
  if (category === "RENTAL" || category === "COMMERCIAL") {
    if (amount < 100000) return formatRupees(amount);
  }
  if (amount >= 10000000) return `₹${trim(amount / 10000000)} Cr`;
  if (amount >= 100000) return `₹${trim(amount / 100000)} L`;
  return formatRupees(amount);
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

// Every outbound link carries a source tag so leads are attributed to a channel.
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function daysSince(isoDate: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(isoDate)) / (24 * 60 * 60 * 1000)));
}
