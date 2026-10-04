import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { CookieJar } from "./cookie-jar";

// The sign-in and sign-out Server Actions against the test database, as a direct POST would
// call them: next/headers is an in-memory cookie jar plus request headers, and redirect()
// throws its usual NEXT_REDIRECT error, which these tests read.

const ctx = vi.hoisted(() => ({
  jar: undefined as unknown as import("./cookie-jar").CookieJar,
  headers: new Headers(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ctx.jar, headers: async () => ctx.headers }));

const { requestOtpAction, verifyOtpAction } = await import("@/app/[lang]/login/actions");
const { signOutAction } = await import("../auth/actions");
const { getSession, SESSION_COOKIE } = await import("../auth/session");
const { hashIp } = await import("../auth/otp");

const NOW = new Date("2026-10-01T04:30:00.000Z");

let counter = 0;
function freshPhone(): string {
  counter += 1;
  return `9444${String(counter).padStart(6, "0")}`;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const digest = String((error as { digest?: unknown }).digest);
    if (digest.startsWith("NEXT_REDIRECT;")) return digest.split(";")[2];
    throw error;
  }
  throw new Error("expected a redirect");
}

async function sendCode(phone: string, lang = "en") {
  const state = await requestOtpAction({}, form({ phone, lang }));
  if (!state.sent?.devCode) throw new Error(`no code: ${JSON.stringify(state)}`);
  return state.sent.devCode;
}

// Each test comes from its own client IP, so the per-IP limit never carries over.
let ipCounter = 0;
let clientIp = "";

beforeEach(() => {
  ipCounter += 1;
  clientIp = `203.0.113.${ipCounter}`;
  ctx.jar = new CookieJar();
  ctx.headers = new Headers({ "x-forwarded-for": `${clientIp}, 10.0.0.1` });
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("requestOtpAction", () => {
  it("sends a code and returns the masked number and, outside production, the code", async () => {
    const phone = freshPhone();
    const state = await requestOtpAction({}, form({ phone, lang: "en" }));
    expect(state.error).toBeUndefined();
    expect(state.sent).toMatchObject({ phone: `91${phone}`, maskedPhone: `+91 ******${phone.slice(-4)}`, devCode: expect.stringMatching(/^\d{6}$/) });
    // The first x-forwarded-for entry is the client; only its hash is stored.
    const challenge = await prisma.otpChallenge.findFirstOrThrow({ where: { phone: `91${phone}` } });
    expect(challenge.ipHash).toBe(hashIp(clientIp));
  });

  it("falls back to x-real-ip", async () => {
    ctx.headers = new Headers({ "x-real-ip": "198.18.0.51" });
    const phone = freshPhone();
    await requestOtpAction({}, form({ phone, lang: "en" }));
    expect((await prisma.otpChallenge.findFirstOrThrow({ where: { phone: `91${phone}` } })).ipHash).toBe(hashIp("198.18.0.51"));
  });

  it.each([["12345"], ["abc"], ["9".repeat(21)], [""]])("says invalidPhone for %j and stores nothing", async (phone) => {
    const before = await prisma.otpChallenge.count();
    expect(await requestOtpAction({}, form({ phone, lang: "en" }))).toEqual({ error: "invalidPhone" });
    expect(await prisma.otpChallenge.count()).toBe(before);
  });

  it("says invalidPhone when the phone field is missing", async () => {
    expect(await requestOtpAction({}, form({ lang: "en" }))).toEqual({ error: "invalidPhone" });
  });

  it("keeps the code step open with the error when a resend is refused", async () => {
    const phone = freshPhone();
    const first = await requestOtpAction({}, form({ phone, lang: "en" }));
    const again = await requestOtpAction(first, form({ phone: `91${phone}`, lang: "en", resend: "1" }));
    expect(again.error).toBe("wait");
    expect(again.sent).toMatchObject({ phone: `91${phone}`, devCode: first.sent?.devCode });
  });

  it("does not carry over a forged previous state for another number", async () => {
    const phone = freshPhone();
    await requestOtpAction({}, form({ phone, lang: "en" }));
    const forged = { sent: { phone: "919999999999", maskedPhone: "x", devCode: "123456", sentAt: 1 } };
    const state = await requestOtpAction(forged, form({ phone, lang: "en", resend: "1" }));
    expect(state).toEqual({ error: "wait" });
  });

  it("never returns a carried-over code in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const phone = freshPhone();
    const forged = { sent: { phone: `91${phone}`, maskedPhone: "x", devCode: "123456", sentAt: 1 } };
    // No provider in tests, so production refuses to send; the forged code must not come back.
    const state = await requestOtpAction(forged, form({ phone, lang: "en", resend: "1" }));
    expect(JSON.stringify(state)).not.toContain("123456");
  });
});

describe("verifyOtpAction", () => {
  it("signs in, sets the session cookie and redirects to next", async () => {
    const phone = freshPhone();
    const code = await sendCode(phone);
    const target = await redirectOf(verifyOtpAction({}, form({ phone: `91${phone}`, code, next: "/en/listings?category=RENTAL", lang: "en" })));
    expect(target).toBe("/en/listings?category=RENTAL");

    const token = ctx.jar.get(SESSION_COOKIE)?.value;
    expect(token).toBeTruthy();
    expect(ctx.jar.options.get(SESSION_COOKIE)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect((await getSession())?.user.phone).toBe(`91${phone}`);
  });

  it.each([["//evil.com"], ["https://evil.com"], ["/\\evil.com"], ["/en/login"], [""]])(
    "lands on /en instead of next=%j",
    async (next) => {
      const phone = freshPhone();
      const code = await sendCode(phone);
      expect(await redirectOf(verifyOtpAction({}, form({ phone: `91${phone}`, code, next, lang: "en" })))).toBe("/en");
    },
  );

  it("uses the form's language for the fallback, defaulting to Telugu", async () => {
    const phone = freshPhone();
    const code = await sendCode(phone, "te");
    expect(await redirectOf(verifyOtpAction({}, form({ phone: `91${phone}`, code, lang: "xx" })))).toBe("/te");
  });

  it("says wrongCode for a wrong code and sets no cookie", async () => {
    const phone = freshPhone();
    const code = await sendCode(phone);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await verifyOtpAction({}, form({ phone: `91${phone}`, code: wrong, lang: "en" }))).toEqual({ error: "wrongCode" });
    expect(ctx.jar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("says wrongCode for a malformed code without counting an attempt", async () => {
    const phone = freshPhone();
    await sendCode(phone);
    for (const code of ["12345", "1234567", "abcdef", ""]) {
      expect(await verifyOtpAction({}, form({ phone: `91${phone}`, code, lang: "en" }))).toEqual({ error: "wrongCode" });
    }
    expect((await prisma.otpChallenge.findFirstOrThrow({ where: { phone: `91${phone}` } })).attempts).toBe(0);
  });

  it("says expired once the code has expired", async () => {
    const phone = freshPhone();
    const code = await sendCode(phone);
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    expect(await verifyOtpAction({}, form({ phone: `91${phone}`, code, lang: "en" }))).toEqual({ error: "expired" });
  });
});

describe("signOutAction", () => {
  it("deletes the session, clears the cookie, records auth.sign_out and redirects to /{lang}", async () => {
    const phone = freshPhone();
    const code = await sendCode(phone);
    await redirectOf(verifyOtpAction({}, form({ phone: `91${phone}`, code, lang: "en" })));
    const session = await getSession();
    expect(session).not.toBeNull();

    expect(await redirectOf(signOutAction(form({ lang: "en" })))).toBe("/en");
    expect(ctx.jar.get(SESSION_COOKIE)).toBeUndefined();
    expect(await prisma.session.findUnique({ where: { id: session!.sessionId } })).toBeNull();
    expect(await prisma.auditEvent.count({ where: { action: "auth.sign_out", entityId: session!.sessionId } })).toBe(1);
  });

  it("redirects to Telugu for an unknown language, and works when signed out", async () => {
    expect(await redirectOf(signOutAction(form({ lang: "https://evil.com" })))).toBe("/te");
  });
});
