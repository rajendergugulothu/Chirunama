"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { afterSignInPath } from "@/lib/auth/guards";
import { clientIp, requestOtp, verifyOtp } from "@/lib/auth/otp";
import { setSessionCookie } from "@/lib/auth/session";
import { isProduction } from "@/lib/env";
import { maskPhone, normalizePhone } from "@/lib/phone";

// Phone sign-in, step 1 (send a code) and step 2 (check it). Both are reachable by direct
// POST, so every field is validated here; rate limits and attempt counts live in otp.ts.
// The language comes from the form: next/root-params is not available in Server Actions.

export type RequestError = "invalidPhone" | "wait" | "tooMany" | "sendFailed";
export type VerifyError = "wrongCode" | "expired";

// The code step's details: the phone the code went to (the user's own number) and, outside
// production only, the code itself.
export type SentCode = { phone: string; maskedPhone: string; devCode?: string; sentAt: number };
export type RequestState = { sent?: SentCode; error?: RequestError };
export type VerifyState = { error?: VerifyError };

const langField = z.enum(["te", "en"]).catch("te");

const requestInput = z.object({
  phone: z.string().max(20),
  lang: langField,
  resend: z.literal("1").optional().catch(undefined),
});

const verifyInput = z.object({
  phone: z.string().max(20),
  code: z.string().trim().regex(/^\d{6}$/),
  next: z.string().max(500).optional().catch(undefined),
  lang: langField,
});

// The previous state comes back from the browser, so it is checked before it is reused.
const sentCode = z.object({
  phone: z.string(),
  devCode: z.string().regex(/^\d{6}$/).optional(),
  sentAt: z.number(),
});

const field = (formData: FormData, name: string) => formData.get(name) ?? undefined;

export async function requestOtpAction(prev: RequestState, formData: FormData): Promise<RequestState> {
  const input = requestInput.safeParse({
    phone: field(formData, "phone"),
    lang: field(formData, "lang"),
    resend: field(formData, "resend"),
  });
  if (!input.success) return { error: "invalidPhone" };
  const { phone, lang, resend } = input.data;

  const result = await requestOtp({ phone, ip: clientIp(await headers()), lang });
  if (result.ok) {
    return {
      sent: { phone: result.phone, maskedPhone: maskPhone(result.phone), devCode: result.devCode, sentAt: Date.now() },
    };
  }

  // A refused "Send a new code" stays on the code step with the error: after "wait" or
  // "tooMany" the code already sent still works.
  const previous = sentCode.safeParse(prev?.sent);
  if (resend && previous.success && previous.data.phone === normalizePhone(phone)) {
    const { phone: sentTo, devCode, sentAt } = previous.data;
    const sent = { phone: sentTo, maskedPhone: maskPhone(sentTo), devCode: isProduction() ? undefined : devCode, sentAt };
    return { sent, error: result.error };
  }
  return { error: result.error };
}

export async function verifyOtpAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const input = verifyInput.safeParse({
    phone: field(formData, "phone"),
    code: field(formData, "code"),
    next: field(formData, "next"),
    lang: field(formData, "lang"),
  });
  if (!input.success) return { error: "wrongCode" };
  const { phone, code, next, lang } = input.data;

  const result = await verifyOtp({ phone, code, lang });
  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.session.token, result.session.expiresAt);
  redirect(afterSignInPath(next, lang));
}
