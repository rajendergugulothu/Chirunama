import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { CookieJar } from "./cookie-jar";

// Database sessions against the test database, with next/headers' cookies() replaced by an
// in-memory jar. The clock is frozen at a fixed instant (only Date is faked).

const jar = vi.hoisted(() => ({ current: undefined as unknown as import("./cookie-jar").CookieJar }));
vi.mock("next/headers", () => ({ cookies: async () => jar.current, headers: async () => new Headers() }));

const { createSession, destroySession, getSession, insertSession, SESSION_COOKIE, SESSION_TTL_DAYS } = await import("../auth/session");

const NOW = new Date("2026-10-01T04:30:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

async function userId(phone: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
}

beforeEach(() => {
  jar.current = new CookieJar();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("createSession", () => {
  it("stores the sha256 hex of the token, never the token, and sets the cookie", async () => {
    const id = await userId("919000000301");
    const { token, sessionId, expiresAt } = await createSession(id);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
    expect(sessionId).toBe(createHash("sha256").update(token).digest("hex"));
    expect(sessionId).not.toBe(token);
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();

    const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.userId).toBe(id);
    expect(row.expiresAt).toEqual(expiresAt);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(SESSION_TTL_DAYS * DAY);
    expect(SESSION_TTL_DAYS).toBe(30);

    expect(SESSION_COOKIE).toBe("cn_session");
    expect(jar.current.get(SESSION_COOKIE)?.value).toBe(token);
    expect(jar.current.options.get(SESSION_COOKIE)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 30 * 24 * 60 * 60,
    });
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession(await userId("919000000301"));
    expect(jar.current.options.get(SESSION_COOKIE)?.secure).toBe(true);
  });

  it("gives every session its own token", async () => {
    const id = await userId("919000000301");
    const a = await insertSession(id);
    const b = await insertSession(id);
    expect(a.token).not.toBe(b.token);
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});

describe("getSession", () => {
  it("returns the signed-in user for a valid cookie", async () => {
    const id = await userId("919000000900");
    const { token, sessionId } = await insertSession(id);
    jar.current.set(SESSION_COOKIE, token);

    expect(await getSession()).toEqual({
      sessionId,
      user: { id, phone: "919000000900", name: "Kavitha (Ops lead)", roles: ["ADMIN"], language: "EN" },
    });
  });

  it("returns null without a cookie, or for an unknown token", async () => {
    expect(await getSession()).toBeNull();
    jar.current.set(SESSION_COOKIE, "not-a-real-token");
    expect(await getSession()).toBeNull();
  });

  it("does not accept the stored hash as a cookie", async () => {
    const { sessionId } = await insertSession(await userId("919000000301"));
    jar.current.set(SESSION_COOKIE, sessionId);
    expect(await getSession()).toBeNull();
  });

  it("returns null for an expired session and deletes its row", async () => {
    const { token, sessionId } = await insertSession(await userId("919000000301"));
    jar.current.set(SESSION_COOKIE, token);

    vi.setSystemTime(new Date(NOW.getTime() + 30 * DAY - 1000));
    expect((await getSession())?.sessionId).toBe(sessionId);

    vi.setSystemTime(new Date(NOW.getTime() + 30 * DAY + 1000));
    expect(await getSession()).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
  });
});

describe("destroySession", () => {
  it("deletes the row, clears the cookie and records auth.sign_out", async () => {
    const id = await userId("919000000302");
    const { token, sessionId } = await insertSession(id);
    jar.current.set(SESSION_COOKIE, token);

    await destroySession();

    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    expect(jar.current.has(SESSION_COOKIE)).toBe(false);
    expect(jar.current.deleted).toContain(SESSION_COOKIE);
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { action: "auth.sign_out", entityId: sessionId } });
    expect(event).toMatchObject({ actorKind: "HUMAN", actor: id, entity: "Session" });
    expect(JSON.stringify([event.before, event.after])).not.toContain(token);

    // The old token no longer authenticates.
    jar.current.set(SESSION_COOKIE, token);
    expect(await getSession()).toBeNull();
  });

  it("only signs out this session, not the user's others", async () => {
    const id = await userId("919000000302");
    const mine = await insertSession(id);
    const other = await insertSession(id);
    jar.current.set(SESSION_COOKIE, mine.token);
    await destroySession();
    expect(await prisma.session.findUnique({ where: { id: other.sessionId } })).not.toBeNull();
  });

  it("does nothing without a session", async () => {
    const events = await prisma.auditEvent.count({ where: { action: "auth.sign_out" } });
    await destroySession();
    jar.current.set(SESSION_COOKIE, "unknown");
    await destroySession();
    expect(await prisma.auditEvent.count({ where: { action: "auth.sign_out" } })).toBe(events);
  });
});
