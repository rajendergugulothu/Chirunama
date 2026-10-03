import "server-only";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { sendNow } from "@/lib/messaging/outbox";
import { normalizePhone } from "@/lib/phone";
import { insertSession, type IssuedSession } from "./session";

// Phone sign-in with a 6-digit code sent on WhatsApp. Only an HMAC of the code is stored, the
// outbox row holds a redacted copy, and the code is returned for display only outside production.

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_COOLDOWN_MS = 30 * 1000;
export const OTP_PER_PHONE_15MIN = 3;
export const OTP_PER_PHONE_DAY = 10;
export const OTP_PER_IP_HOUR = 20;

const MINUTE = 60 * 1000;
const REDACTED = "••••••";

export type OtpLang = "te" | "en";

export type RequestOtpResult =
  | { ok: true; phone: string; devCode?: string }
  | { ok: false; error: "invalidPhone" | "wait" | "tooMany" | "sendFailed" };

export type VerifyOtpResult =
  | { ok: true; userId: string; session: IssuedSession }
  | { ok: false; error: "wrongCode" | "expired" };

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashCode(phone: string, code: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`otp:${phone}:${code}`).digest("hex");
}

// Only a keyed hash of the IP is stored: enough to count requests, not to recover the address.
export function hashIp(ip: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`ip:${ip}`).digest("hex");
}

// The client IP as the first x-forwarded-for entry, falling back to x-real-ip.
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}

const OTP_MESSAGE: Record<OtpLang, (code: string) => string> = {
  en: (code) => `Your Chirunama sign-in code is ${code}. It expires in 5 minutes. Do not share it with anyone.`,
  te: (code) => `మీ చిరునామా సైన్-ఇన్ కోడ్ ${code}. ఇది 5 నిమిషాల్లో ముగుస్తుంది. ఎవరితోనూ పంచుకోవద్దు.`,
};

export function otpMessage(lang: OtpLang, code: string): string {
  return OTP_MESSAGE[lang](code);
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requestOtp({
  phone: input,
  ip,
  lang,
}: {
  phone: string;
  ip?: string | null;
  lang: OtpLang;
}): Promise<RequestOtpResult> {
  const phone = normalizePhone(input);
  if (!phone) return { ok: false, error: "invalidPhone" };
  const ipHash = ip ? hashIp(ip) : null;
  const code = generateCode();

  // Serialise requests per phone so parallel submits cannot slip past the limits.
  const limited = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`;
    const now = Date.now();
    const since = (ms: number) => new Date(now - ms);
    const last15 = await tx.otpChallenge.count({ where: { phone, createdAt: { gt: since(15 * MINUTE) } } });
    const lastDay = await tx.otpChallenge.count({ where: { phone, createdAt: { gt: since(24 * 60 * MINUTE) } } });
    const fromIp = ipHash ? await tx.otpChallenge.count({ where: { ipHash, createdAt: { gt: since(60 * MINUTE) } } }) : 0;
    if (last15 >= OTP_PER_PHONE_15MIN || lastDay >= OTP_PER_PHONE_DAY || fromIp >= OTP_PER_IP_HOUR) {
      return "tooMany" as const;
    }
    const latest = await tx.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latest && latest.createdAt.getTime() > now - OTP_COOLDOWN_MS) return "wait" as const;
    await tx.otpChallenge.create({
      data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(now + OTP_TTL_MS), ipHash },
    });
    return null;
  });
  if (limited) return { ok: false, error: limited };

  const delivery = await sendNow(
    {
      channel: "WHATSAPP",
      to: phone,
      purpose: "otp",
      body: otpMessage(lang, code),
      template: env().WHATSAPP_OTP_TEMPLATE,
      params: [code],
      language: lang === "en" ? "EN" : "TE",
    },
    { redact: { body: otpMessage(lang, REDACTED), params: [REDACTED] } },
  );

  if (isProduction()) {
    if (delivery.status === "LOGGED" || delivery.status === "FAILED") return { ok: false, error: "sendFailed" };
    return { ok: true, phone };
  }
  return { ok: true, phone, devCode: code };
}

// Checks the code against the phone's latest unconsumed challenge. On success, in one
// transaction: consumes the phone's challenges, creates the user if new, grants ADMIN to
// ADMIN_PHONES, writes the session row and the audit events. The caller sets the cookie.
export async function verifyOtp({
  phone: input,
  code,
  lang = "te",
}: {
  phone: string;
  code: string;
  lang?: OtpLang;
}): Promise<VerifyOtpResult> {
  const phone = normalizePhone(input);
  if (!phone) return { ok: false, error: "expired" };

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const challenge = await tx.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.expiresAt <= now) return { ok: false, error: "expired" } as const;

    // Count the attempt first, atomically, so parallel guesses cannot exceed the limit.
    const counted = await tx.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) return { ok: false, error: "expired" } as const;
    if (!/^\d{6}$/.test(code) || !sameHash(hashCode(phone, code), challenge.codeHash)) {
      return { ok: false, error: "wrongCode" } as const;
    }

    const consumed = await tx.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count === 0) return { ok: false, error: "expired" } as const;
    // Any older codes for this phone stop working too.
    await tx.otpChallenge.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: now } });

    let user = await tx.user.findUnique({ where: { phone }, select: { id: true, roles: true } });
    if (!user) {
      user = await tx.user.create({
        data: { phone, language: lang === "en" ? "EN" : "TE" },
        select: { id: true, roles: true },
      });
      await audit(
        { actor: { kind: "HUMAN", id: user.id }, action: "user.create", entity: "User", entityId: user.id, after: { roles: user.roles } },
        tx,
      );
    }

    if (env().ADMIN_PHONES.includes(phone) && !user.roles.includes("ADMIN")) {
      const before = user.roles;
      user = await tx.user.update({
        where: { id: user.id },
        data: { roles: { push: "ADMIN" } },
        select: { id: true, roles: true },
      });
      await audit(
        {
          actor: { kind: "AGENT", id: "system:admin_phones" },
          action: "user.role_grant",
          entity: "User",
          entityId: user.id,
          before: { roles: before },
          after: { roles: user.roles },
        },
        tx,
      );
    }

    const session = await insertSession(user.id, tx);
    await audit(
      { actor: { kind: "HUMAN", id: user.id }, action: "auth.sign_in", entity: "Session", entityId: session.sessionId },
      tx,
    );
    return { ok: true, userId: user.id, session } as const;
  });
}
