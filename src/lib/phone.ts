// Indian mobile numbers are stored as 91XXXXXXXXXX: country code, no plus, no spaces.

const MOBILE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

// Accepts a 10-digit mobile number starting 6-9, optionally prefixed with +91, 91 or 0,
// with spaces or dashes anywhere. Returns null for anything else.
export function normalizePhone(input: string): string | null {
  if (typeof input !== "string" || input.length > 32) return null;
  const match = MOBILE.exec(input.trim().replace(/[\s-]/g, ""));
  return match ? `91${match[1]}` : null;
}

// "+91 ******0001": enough for people to recognise their own number on screen.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91 ${"*".repeat(Math.max(0, national.length - 4))}${national.slice(-4)}`;
}
