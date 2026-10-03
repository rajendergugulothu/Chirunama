import "server-only";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/i18n/dictionaries";
import type { Role } from "@/generated/prisma/enums";
import { getSession, type SessionUser } from "./session";

// Page guards for Server Components. Every protected page and data call checks for itself;
// a layout check alone is not enough.

// A same-origin path to return to after sign-in, or /{lang}. Rejects protocol-relative URLs
// (//host), backslashes (browsers treat /\host as //host), schemes and control characters.
export function safeNext(raw: unknown, lang: string): string {
  const fallback = `/${lang}`;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  if (/\s/.test(raw) || [...raw].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;
  return raw;
}

// The signed-in user, or a redirect to /{lang}/login?next=<nextPath>.
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const lang = await getLocale();
    redirect(`/${lang}/login?next=${encodeURIComponent(safeNext(nextPath, lang))}`);
  }
  return session.user;
}

// Like requireUser, then a 404 for users without the role so the area's existence stays hidden.
export async function requireRole(role: Role, nextPath: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!user.roles.includes(role)) notFound();
  return user;
}
