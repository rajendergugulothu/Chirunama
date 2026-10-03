import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { audit } from "@/lib/audit";
import { prisma, type Db } from "@/lib/db";
import { isProduction } from "@/lib/env";
import type { Language, Role } from "@/generated/prisma/enums";

// Database sessions. The cookie holds a random token; the Session row's id is its SHA-256,
// so a leaked database row cannot be replayed as a cookie.

export const SESSION_COOKIE = "cn_session";
export const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; phone: string; name: string | null; roles: Role[]; language: Language };
export type SessionInfo = { user: SessionUser; sessionId: string };
export type IssuedSession = { token: string; sessionId: string; expiresAt: Date };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Writes the Session row and returns the token for the cookie. Takes a transaction client so
// sign-in can create the session together with the user.
export async function insertSession(userId: string, db: Db = prisma): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: sessionId, userId, expiresAt } });
  return { token, sessionId, expiresAt };
}

// Only in a Server Function or Route Handler.
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProduction(),
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

// Only in a Server Function or Route Handler.
export async function createSession(userId: string, db: Db = prisma): Promise<IssuedSession> {
  const session = await insertSession(userId, db);
  await setSessionCookie(session.token, session.expiresAt);
  return session;
}

// The signed-in user for this request, or null. Expired rows are deleted on sight.
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sessionId = hashToken(token);
  const row = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      expiresAt: true,
      user: { select: { id: true, phone: true, name: true, roles: true, language: true } },
    },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
    return null;
  }
  return { user: row.user, sessionId };
});

// Signs out: deletes the row, clears the cookie and records auth.sign_out.
// Only in a Server Function or Route Handler.
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return;
  const sessionId = hashToken(token);
  const row = await prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (!row) return;
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { id: sessionId } });
    await audit(
      { actor: { kind: "HUMAN", id: row.userId }, action: "auth.sign_out", entity: "Session", entityId: sessionId },
      tx,
    );
  });
}
