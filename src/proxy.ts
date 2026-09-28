import { NextResponse, type NextRequest } from "next/server";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) {
    // Remember the last language the reader chose, including via the one-tap switch.
    const response = NextResponse.next();
    response.cookies.set("lang", pathname.split("/")[1], { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  request.nextUrl.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|manifest.webmanifest|.*\\..*).*)"],
};
