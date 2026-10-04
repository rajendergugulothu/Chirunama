import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "../auth/session";

// The session is mocked: these are pure checks of the guards' decisions. The database-backed
// session itself is covered in session.db.test.ts.
const state = vi.hoisted(() => ({ session: null as SessionInfo | null, lang: "en" }));

vi.mock("../auth/session", () => ({ getSession: async () => state.session }));
vi.mock("next/root-params", () => ({ lang: async () => state.lang }));

const { afterSignInPath, requireRole, requireUser, safeNext } = await import("../auth/guards");

function session(roles: SessionInfo["user"]["roles"]): SessionInfo {
  return {
    sessionId: "s1",
    user: { id: "u1", phone: "919000000301", name: null, roles, language: "EN" },
  };
}

// redirect() and notFound() throw errors whose digest says what Next.js should do.
async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return String((error as { digest?: unknown }).digest);
  }
  throw new Error("expected the guard to throw");
}

describe("safeNext", () => {
  it("accepts a same-origin path", () => {
    expect(safeNext("/te/dashboard", "te")).toBe("/te/dashboard");
    expect(safeNext("/en/listings?category=RENTAL", "en")).toBe("/en/listings?category=RENTAL");
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:x", "evil.com", "", "/te/\tx", "/te\n/x", " /te"])(
    "falls back to /{lang} for %j",
    (raw) => {
      expect(safeNext(raw, "te")).toBe("/te");
    },
  );

  it("falls back for non-strings and over-long values", () => {
    expect(safeNext(undefined, "en")).toBe("/en");
    expect(safeNext(["/te/dashboard"], "en")).toBe("/en");
    expect(safeNext(`/${"a".repeat(600)}`, "en")).toBe("/en");
  });
});

describe("afterSignInPath", () => {
  it("never sends a signed-in user back to the login page", () => {
    expect(afterSignInPath("/en/login", "en")).toBe("/en");
    expect(afterSignInPath("/te/login?next=/te/dashboard", "te")).toBe("/te");
    expect(afterSignInPath("/en/dashboard", "en")).toBe("/en/dashboard");
    expect(afterSignInPath("//evil.com", "en")).toBe("/en");
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    state.session = null;
    state.lang = "en";
  });

  it("redirects a signed-out visitor to the login page with next", async () => {
    expect(await digestOf(requireUser("/en/dashboard"))).toContain(";/en/login?next=%2Fen%2Fdashboard;");
  });

  it("uses the page's language for the login link", async () => {
    state.lang = "te";
    expect(await digestOf(requireUser("/te/admin/outbox"))).toContain(";/te/login?next=%2Fte%2Fadmin%2Foutbox;");
  });

  it("never puts an unsafe next into the login link", async () => {
    expect(await digestOf(requireUser("//evil.com"))).toContain(";/en/login?next=%2Fen;");
  });

  it("returns the signed-in user", async () => {
    state.session = session(["BUYER"]);
    await expect(requireUser("/en/dashboard")).resolves.toMatchObject({ id: "u1" });
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    state.session = null;
    state.lang = "en";
  });

  it("sends a signed-out visitor to the login page, not a 404", async () => {
    expect(await digestOf(requireRole("ADMIN", "/en/admin"))).toContain(";/en/login?next=%2Fen%2Fadmin;");
  });

  it("gives a 404 to a signed-in user without the role", async () => {
    state.session = session(["BUYER", "BROKER"]);
    expect(await digestOf(requireRole("ADMIN", "/en/admin"))).toMatch(/404/);
  });

  it("lets a user with the role through", async () => {
    state.session = session(["ADMIN"]);
    await expect(requireRole("ADMIN", "/en/admin")).resolves.toMatchObject({ roles: ["ADMIN"] });
  });
});
