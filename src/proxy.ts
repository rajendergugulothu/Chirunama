import { NextResponse, type NextRequest } from "next/server";
import { LEAD_SOURCE_COOKIE, LEAD_SOURCE_MAX_AGE, parseLeadSource } from "@/lib/attribution-rules";

const locales = ["te", "en"];

// Share links such as /agent/ramesh-realty carry no locale; send them to the reader's language.
function preferredLocale(request: NextRequest): string {
  const saved = request.cookies.get("lang")?.value;
  if (saved && locales.includes(saved)) return saved;
  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const te = ranked.find((r) => r.lang === "te");
  const en = ranked.find((r) => r.lang === "en");
  // Telugu-first: English only when the browser prefers it over Telugu.
  if (en && (!te || en.q > te.q)) return "en";
  return "te";
}

// Share links carry ?src=<channel> (any case); remember the latest valid one so a later
// enquiry can be attributed to it. Unknown values are ignored.
function withLeadSource(request: NextRequest, response: NextResponse): NextResponse {
  const source = parseLeadSource(request.nextUrl.searchParams.get("src"));
  if (source) {
    response.cookies.set(LEAD_SOURCE_COOKIE, source, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: LEAD_SOURCE_MAX_AGE,
    });
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) {
    // Remember the last language the reader chose, including via the one-tap switch.
    const response = NextResponse.next();
    response.cookies.set("lang", pathname.split("/")[1], { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return withLeadSource(request, response);
  }

  // The redirect keeps the query string, including ?src=.
  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return withLeadSource(request, NextResponse.redirect(url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|manifest.webmanifest|.*\\..*).*)"],
};
