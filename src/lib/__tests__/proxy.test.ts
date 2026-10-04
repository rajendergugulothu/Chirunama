import { NextRequest, type NextResponse } from "next/server";
// The docs call the matcher helper unstable_doesProxyMatch; this Next.js version exports it
// under its older name.
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const BASE = "http://localhost:3100";

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(path, BASE), { headers });
}

function run(path: string, headers?: Record<string, string>): NextResponse {
  return proxy(request(path, headers)) as NextResponse;
}

// All Set-Cookie headers as one string per cookie.
function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

describe("proxy: lead attribution", () => {
  it("remembers ?src= on a localised page, whatever its case", () => {
    const response = run("/te/agent/ramesh-realty?src=Instagram");
    expect(response.cookies.get("cn_src")).toMatchObject({
      value: "INSTAGRAM",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    const header = setCookies(response).find((c) => c.startsWith("cn_src="));
    expect(header).toMatch(/^cn_src=INSTAGRAM;/);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Max-Age=2592000/);
  });

  it("sets cn_src on the locale redirect and keeps ?src= in the target", () => {
    const response = run("/agent/ramesh-realty?src=qr", { "accept-language": "en-IN,en;q=0.9" });
    expect(response.status).toBe(307);
    const target = new URL(getRedirectUrl(response)!);
    expect(target.pathname).toBe("/en/agent/ramesh-realty");
    expect(target.searchParams.get("src")).toBe("qr");
    expect(response.cookies.get("cn_src")?.value).toBe("QR");
  });

  it("ignores unknown sources", () => {
    expect(run("/te/agent/ramesh-realty?src=bogus").cookies.get("cn_src")).toBeUndefined();
    expect(run("/agent/ramesh-realty?src=bogus").cookies.get("cn_src")).toBeUndefined();
    expect(run("/te/listings").cookies.get("cn_src")).toBeUndefined();
  });

  it("lets the most recent valid tag win", () => {
    const response = run("/en/listings?src=whatsapp", { cookie: "cn_src=INSTAGRAM" });
    expect(response.cookies.get("cn_src")?.value).toBe("WHATSAPP");
  });
});

describe("proxy: language", () => {
  it("remembers the language of a localised page for a year", () => {
    const response = run("/en/listings");
    expect(response.cookies.get("lang")).toMatchObject({ value: "en", path: "/", maxAge: 60 * 60 * 24 * 365 });
    expect(getRedirectUrl(response)).toBeNull();
  });

  it("still sets lang when ?src= is present", () => {
    const response = run("/te/agent/ramesh-realty?src=Instagram");
    expect(response.cookies.get("lang")?.value).toBe("te");
  });

  it("redirects unlocalised paths to Telugu by default", () => {
    expect(new URL(getRedirectUrl(run("/agent/ramesh-realty"))!).pathname).toBe("/te/agent/ramesh-realty");
    expect(new URL(getRedirectUrl(run("/"))!).pathname).toBe("/te");
  });

  it("uses the saved lang cookie before the browser's languages", () => {
    const response = run("/listings", { cookie: "lang=en", "accept-language": "te" });
    expect(new URL(getRedirectUrl(response)!).pathname).toBe("/en/listings");
  });

  it("uses English only when the browser prefers it over Telugu", () => {
    expect(new URL(getRedirectUrl(run("/listings", { "accept-language": "en-US,en;q=0.9" }))!).pathname).toBe("/en/listings");
    expect(new URL(getRedirectUrl(run("/listings", { "accept-language": "te,en;q=0.8" }))!).pathname).toBe("/te/listings");
  });

  it("does not run for API routes or static files", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/files/photos/x.jpg" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/favicon.ico" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/agent/ramesh-realty" })).toBe(true);
  });
});
