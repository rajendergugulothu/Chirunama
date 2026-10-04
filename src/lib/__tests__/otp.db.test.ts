import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashCode, hashIp, OTP_TTL_MS, requestOtp, verifyOtp } from "../auth/otp";
import { hashToken } from "../auth/session";

// Phone sign-in against the test database. The clock is frozen at a fixed instant (only Date
// is faked, so database timers still run); "later" means moving that clock, never today's date.

const NOW = new Date("2026-10-01T04:30:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;

// Each test uses its own numbers and IPs so rate limits never carry over between tests.
let counter = 0;
function freshPhone(): string {
  counter += 1;
  return `9555${String(counter).padStart(6, "0")}`;
}
function freshIp(): string {
  counter += 1;
  return `198.51.${Math.floor(counter / 250)}.${counter % 250}`;
}
const full = (phone: string) => `91${phone.slice(-10)}`;

function at(ms: number) {
  vi.setSystemTime(new Date(NOW.getTime() + ms));
}

// Moves a phone's challenges back in time, as if they had been asked for earlier.
async function backdate(phone: string, ms: number) {
  await prisma.$executeRaw`
    UPDATE "OtpChallenge" SET "createdAt" = "createdAt" - (${ms} * interval '1 millisecond')
    WHERE phone = ${full(phone)}`;
}

async function codeFor(phone: string, ip = freshIp(), lang: "te" | "en" = "en"): Promise<string> {
  const result = await requestOtp({ phone, ip, lang });
  if (!result.ok || !result.devCode) throw new Error(`requestOtp failed: ${JSON.stringify(result)}`);
  return result.devCode;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("requestOtp", () => {
  it("stores one challenge with only a keyed hash of the code, expiring in 5 minutes", async () => {
    const phone = freshPhone();
    const ip = "203.0.113.7";
    const result = await requestOtp({ phone, ip, lang: "en" });

    expect(result).toEqual({ ok: true, phone: full(phone), devCode: expect.stringMatching(/^\d{6}$/) });
    const code = (result as { devCode: string }).devCode;

    const challenges = await prisma.otpChallenge.findMany({ where: { phone: full(phone) } });
    expect(challenges).toHaveLength(1);
    const [challenge] = challenges;
    expect(challenge.codeHash).not.toBe(code);
    expect(challenge.codeHash).not.toContain(code);
    expect(challenge.codeHash).toBe(hashCode(full(phone), code));
    expect(challenge.expiresAt.getTime() - NOW.getTime()).toBe(OTP_TTL_MS);
    expect(challenge.expiresAt.getTime() - challenge.createdAt.getTime()).toBe(5 * MINUTE);
    expect(challenge.attempts).toBe(0);
    expect(challenge.consumedAt).toBeNull();

    // Only a hash of the IP is kept.
    expect(challenge.ipHash).toBe(hashIp(ip));
    expect(challenge.ipHash).not.toContain(ip);
    expect(challenge.ipHash).not.toBe(createHash("sha256").update(ip).digest("hex"));
  });

  it("writes one LOGGED WhatsApp outbox row without the code", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone, freshIp(), "en");

    const rows = await prisma.outbox.findMany({ where: { to: full(phone) } });
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({ channel: "WHATSAPP", purpose: "otp", status: "LOGGED", template: "chirunama_otp", language: "EN" });
    expect(row.body).not.toContain(code);
    expect(JSON.stringify(row.params)).not.toContain(code);
    expect(row.params).toEqual(["••••••"]);
    expect(row.body).toBe("Your Chirunama sign-in code is ••••••. It expires in 5 minutes. Do not share it with anyone.");
  });

  it("writes the Telugu message for Telugu readers", async () => {
    const phone = freshPhone();
    await codeFor(phone, freshIp(), "te");
    const row = await prisma.outbox.findFirstOrThrow({ where: { to: full(phone) } });
    expect(row.language).toBe("TE");
    expect(row.body).toContain("చిరునామా");
    expect(row.body).toContain("••••••");
  });

  it("gives the same answer whether or not the number has an account", async () => {
    const existing = await requestOtp({ phone: "9000000101", ip: freshIp(), lang: "en" });
    const unknown = await requestOtp({ phone: freshPhone(), ip: freshIp(), lang: "en" });
    expect(Object.keys(existing).sort()).toEqual(Object.keys(unknown).sort());
    expect(existing.ok).toBe(true);
    expect(unknown.ok).toBe(true);
  });

  it("rejects an invalid number without storing anything", async () => {
    const before = await prisma.otpChallenge.count();
    for (const phone of ["5000000001", "12345", "abc", ""]) {
      expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "invalidPhone" });
    }
    expect(await prisma.otpChallenge.count()).toBe(before);
  });

  describe("in production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("omits devCode and sends the real code to WhatsApp, storing it redacted", async () => {
      vi.stubEnv("WHATSAPP_TOKEN", "test-token");
      vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234567890");
      const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ messages: [{ id: "wamid.PROD" }] }));
      vi.stubGlobal("fetch", fetchMock);
      const phone = freshPhone();

      const result = await requestOtp({ phone, ip: freshIp(), lang: "te" });

      expect(result).toEqual({ ok: true, phone: full(phone) });
      const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      const code: string = sent.template.components[0].parameters[0].text;
      expect(code).toMatch(/^\d{6}$/);
      const row = await prisma.outbox.findFirstOrThrow({ where: { to: full(phone) } });
      expect(row).toMatchObject({ status: "SENT", providerMessageId: "wamid.PROD", attempts: 1 });
      expect(row.body).not.toContain(code);
      expect(JSON.stringify(row.params)).not.toContain(code);
      // The code that was sent is the one that signs in.
      vi.unstubAllGlobals();
      expect((await verifyOtp({ phone, code })).ok).toBe(true);
    });

    it("says sendFailed when no provider is set up (the row is only LOGGED)", async () => {
      const phone = freshPhone();
      expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "sendFailed" });
      expect((await prisma.outbox.findFirstOrThrow({ where: { to: full(phone) } })).status).toBe("LOGGED");
    });

    it("says sendFailed when WhatsApp refuses the message", async () => {
      vi.stubEnv("WHATSAPP_TOKEN", "test-token");
      vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234567890");
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "bad" } }, { status: 400 })));
      const phone = freshPhone();
      expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "sendFailed" });
      expect((await prisma.outbox.findFirstOrThrow({ where: { to: full(phone) } })).status).toBe("FAILED");
    });
  });
});

describe("requestOtp rate limits", () => {
  it("asks for 30 seconds between codes for one number", async () => {
    const phone = freshPhone();
    await codeFor(phone);
    at(10 * SECOND);
    expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "wait" });
    at(29 * SECOND);
    expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "wait" });
    at(31 * SECOND);
    expect((await requestOtp({ phone, ip: freshIp(), lang: "en" })).ok).toBe(true);
    expect(await prisma.otpChallenge.count({ where: { phone: full(phone) } })).toBe(2);
  });

  it("refuses the 4th code in 15 minutes for one number, even after the cooldown", async () => {
    const phone = freshPhone();
    for (let i = 0; i < 3; i++) {
      expect((await requestOtp({ phone, ip: freshIp(), lang: "en" })).ok).toBe(true);
      await backdate(phone, 31 * SECOND);
    }
    expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "tooMany" });
    expect(await prisma.otpChallenge.count({ where: { phone: full(phone) } })).toBe(3);

    // Once the oldest is more than 15 minutes old, the number may ask again.
    await backdate(phone, 15 * MINUTE);
    expect((await requestOtp({ phone, ip: freshIp(), lang: "en" })).ok).toBe(true);
  });

  it("refuses the 11th code in a day for one number", async () => {
    const phone = freshPhone();
    // Ten earlier codes spread over the last 23 hours, none in the last 15 minutes.
    await prisma.otpChallenge.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        phone: full(phone),
        codeHash: "x",
        expiresAt: new Date(NOW.getTime() - (i + 1) * 2 * 60 * MINUTE + 5 * MINUTE),
        createdAt: new Date(NOW.getTime() - (i + 1) * 2 * 60 * MINUTE - 20 * MINUTE),
      })),
    });
    expect(await requestOtp({ phone, ip: freshIp(), lang: "en" })).toEqual({ ok: false, error: "tooMany" });

    // Once the oldest (20 h 20 min old) is more than a day old, the number may ask again.
    at(4 * 60 * MINUTE);
    expect((await requestOtp({ phone, ip: freshIp(), lang: "en" })).ok).toBe(true);
  });

  it("refuses the 21st code from one IP in an hour, whatever the number", async () => {
    const ip = "192.0.2.21";
    for (let i = 0; i < 20; i++) {
      expect((await requestOtp({ phone: freshPhone(), ip, lang: "en" })).ok).toBe(true);
    }
    expect(await requestOtp({ phone: freshPhone(), ip, lang: "en" })).toEqual({ ok: false, error: "tooMany" });
    expect(await prisma.otpChallenge.count({ where: { ipHash: hashIp(ip) } })).toBe(20);

    // Other IPs are unaffected, and after an hour this one may ask again.
    expect((await requestOtp({ phone: freshPhone(), ip: "192.0.2.22", lang: "en" })).ok).toBe(true);
    at(60 * MINUTE + SECOND);
    expect((await requestOtp({ phone: freshPhone(), ip, lang: "en" })).ok).toBe(true);
  });

  it("does not let parallel requests slip past the cooldown", async () => {
    const phone = freshPhone();
    const results = await Promise.all(Array.from({ length: 5 }, () => requestOtp({ phone, ip: freshIp(), lang: "en" })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "wait")).toHaveLength(4);
    expect(await prisma.otpChallenge.count({ where: { phone: full(phone) } })).toBe(1);
  });
});

describe("verifyOtp", () => {
  it("rejects a wrong code and counts the attempt", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    const wrong = code === "000000" ? "111111" : "000000";

    expect(await verifyOtp({ phone, code: wrong })).toEqual({ ok: false, error: "wrongCode" });
    const challenge = await prisma.otpChallenge.findFirstOrThrow({ where: { phone: full(phone) } });
    expect(challenge.attempts).toBe(1);
    expect(challenge.consumedAt).toBeNull();
  });

  it("refuses even the right code after 5 wrong attempts", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await verifyOtp({ phone, code: wrong })).toEqual({ ok: false, error: "wrongCode" });

    expect(await verifyOtp({ phone, code })).toEqual({ ok: false, error: "expired" });
    expect((await prisma.otpChallenge.findFirstOrThrow({ where: { phone: full(phone) } })).attempts).toBe(5);
  });

  it("counts parallel guesses atomically, never past 5", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    const wrong = code === "000000" ? "111111" : "000000";
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyOtp({ phone, code: wrong })));
    expect(results.filter((r) => !r.ok && r.error === "wrongCode")).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.error === "expired")).toHaveLength(3);
    expect((await prisma.otpChallenge.findFirstOrThrow({ where: { phone: full(phone) } })).attempts).toBe(5);
    expect(await verifyOtp({ phone, code })).toEqual({ ok: false, error: "expired" });
  });

  it("refuses a code older than 5 minutes", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    at(5 * MINUTE + SECOND);
    expect(await verifyOtp({ phone, code })).toEqual({ ok: false, error: "expired" });
  });

  it("accepts a code just inside 5 minutes", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    at(5 * MINUTE - SECOND);
    expect((await verifyOtp({ phone, code })).ok).toBe(true);
  });

  it("accepts the right code once; a second use is expired", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    const first = await verifyOtp({ phone, code });
    expect(first).toMatchObject({ ok: true, userId: expect.any(String) });
    expect((await prisma.otpChallenge.findFirstOrThrow({ where: { phone: full(phone) } })).consumedAt).toEqual(NOW);
    expect(await verifyOtp({ phone, code })).toEqual({ ok: false, error: "expired" });
  });

  it("checks the latest code only, and signing in retires the older ones", async () => {
    const phone = freshPhone();
    const older = await codeFor(phone);
    at(31 * SECOND);
    const latest = await codeFor(phone);
    if (older !== latest) expect(await verifyOtp({ phone, code: older })).toEqual({ ok: false, error: "wrongCode" });
    expect((await verifyOtp({ phone, code: latest })).ok).toBe(true);
    expect(await prisma.otpChallenge.count({ where: { phone: full(phone), consumedAt: null } })).toBe(0);
  });

  it("says expired when there is no code, or the number is invalid", async () => {
    expect(await verifyOtp({ phone: freshPhone(), code: "123456" })).toEqual({ ok: false, error: "expired" });
    expect(await verifyOtp({ phone: "12345", code: "123456" })).toEqual({ ok: false, error: "expired" });
  });

  it("treats a malformed code as wrong", async () => {
    const phone = freshPhone();
    await codeFor(phone);
    expect(await verifyOtp({ phone, code: "12ab56" })).toEqual({ ok: false, error: "wrongCode" });
    expect(await verifyOtp({ phone, code: "" })).toEqual({ ok: false, error: "wrongCode" });
  });

  it("does not accept a code issued to another number", async () => {
    const victim = freshPhone();
    const attacker = freshPhone();
    const code = await codeFor(victim);
    await codeFor(attacker);
    expect(await verifyOtp({ phone: attacker, code })).toMatchObject({ ok: false });
  });
});

describe("verifyOtp: users, roles, sessions and audit", () => {
  it("creates a new user with no roles, in the reader's language, with user.create and auth.sign_in events", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    const result = await verifyOtp({ phone, code, lang: "en" });
    if (!result.ok) throw new Error(`verify failed: ${result.error}`);

    const user = await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } });
    expect(user.id).toBe(result.userId);
    expect(user.roles).toEqual([]);
    expect(user.language).toBe("EN");

    const events = await prisma.auditEvent.findMany({ where: { OR: [{ entityId: user.id }, { entityId: result.session.sessionId }] }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.action).sort()).toEqual(["auth.sign_in", "user.create"]);
    expect(events.find((e) => e.action === "user.create")).toMatchObject({ actorKind: "HUMAN", actor: user.id, entity: "User", after: { roles: [] } });
    expect(events.find((e) => e.action === "auth.sign_in")).toMatchObject({ actorKind: "HUMAN", actor: user.id, entity: "Session" });

    // The session row is written in the same step, keyed by the token's hash.
    const session = await prisma.session.findUniqueOrThrow({ where: { id: result.session.sessionId } });
    expect(session.id).toBe(hashToken(result.session.token));
    expect(session.userId).toBe(user.id);
    expect(session.expiresAt.getTime() - NOW.getTime()).toBe(30 * 24 * 60 * MINUTE);

    // Never a code, token or hash in audit JSON.
    const json = JSON.stringify(events.map((e) => [e.before, e.after]));
    for (const secret of [code, result.session.token, result.session.sessionId, hashCode(full(phone), code)]) expect(json).not.toContain(secret);
  });

  it("defaults a new user's language to Telugu", async () => {
    const phone = freshPhone();
    const result = await verifyOtp({ phone, code: await codeFor(phone, freshIp(), "te"), lang: "te" });
    expect(result.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } })).language).toBe("TE");
  });

  it("signs an existing user in without creating another user or a user.create event", async () => {
    const phone = "9000000302";
    const before = await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } });
    const result = await verifyOtp({ phone, code: await codeFor(phone), lang: "en" });
    if (!result.ok) throw new Error(`verify failed: ${result.error}`);

    expect(result.userId).toBe(before.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } });
    expect(after.roles).toEqual(before.roles);
    expect(after.language).toBe(before.language); // only set on create
    expect(await prisma.auditEvent.count({ where: { action: "user.create", entityId: before.id } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { action: "auth.sign_in", entityId: result.session.sessionId } })).toBe(1);
  });

  it("grants ADMIN to a number in ADMIN_PHONES, with a user.role_grant event from system:admin_phones", async () => {
    const phone = freshPhone();
    vi.stubEnv("ADMIN_PHONES", `919000000900,${full(phone)}`);
    const result = await verifyOtp({ phone, code: await codeFor(phone), lang: "en" });
    if (!result.ok) throw new Error(`verify failed: ${result.error}`);

    const user = await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } });
    expect(user.roles).toEqual(["ADMIN"]);
    const grant = await prisma.auditEvent.findFirstOrThrow({ where: { action: "user.role_grant", entityId: user.id } });
    expect(grant).toMatchObject({
      actorKind: "AGENT",
      actor: "system:admin_phones",
      entity: "User",
      before: { roles: [] },
      after: { roles: ["ADMIN"] },
    });

    // Signing in again grants nothing new.
    at(31 * SECOND);
    const again = await verifyOtp({ phone, code: await codeFor(phone), lang: "en" });
    expect(again.ok).toBe(true);
    expect(await prisma.auditEvent.count({ where: { action: "user.role_grant", entityId: user.id } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } })).roles).toEqual(["ADMIN"]);
  });

  it("adds ADMIN to an existing user's roles without removing them", async () => {
    const phone = freshPhone();
    const existing = await prisma.user.create({ data: { phone: full(phone), roles: ["BUYER"] } });
    vi.stubEnv("ADMIN_PHONES", full(phone));
    expect((await verifyOtp({ phone, code: await codeFor(phone), lang: "en" })).ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).roles).toEqual(["BUYER", "ADMIN"]);
    expect(await prisma.auditEvent.findFirstOrThrow({ where: { action: "user.role_grant", entityId: existing.id } })).toMatchObject({
      before: { roles: ["BUYER"] },
      after: { roles: ["BUYER", "ADMIN"] },
    });
  });

  it("does not grant ADMIN to numbers outside ADMIN_PHONES", async () => {
    const phone = freshPhone();
    vi.stubEnv("ADMIN_PHONES", "919000000900");
    expect((await verifyOtp({ phone, code: await codeFor(phone), lang: "en" })).ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: full(phone) } });
    expect(user.roles).toEqual([]);
    expect(await prisma.auditEvent.count({ where: { action: "user.role_grant", entityId: user.id } })).toBe(0);
  });

  it("writes nothing when the code is wrong", async () => {
    const phone = freshPhone();
    const code = await codeFor(phone);
    const sessions = await prisma.session.count();
    await verifyOtp({ phone, code: code === "000000" ? "111111" : "000000" });
    expect(await prisma.user.findUnique({ where: { phone: full(phone) } })).toBeNull();
    expect(await prisma.session.count()).toBe(sessions);
  });
});
