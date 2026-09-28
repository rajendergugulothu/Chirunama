import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Noto_Sans, Noto_Sans_Telugu } from "next/font/google";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, hasLocale, locales } from "@/i18n/dictionaries";
import { LanguageSwitch } from "@/components/language-switch";
import "../globals.css";

const notoSans = Noto_Sans({ variable: "--font-latin", subsets: ["latin"] });
const notoTelugu = Noto_Sans_Telugu({ variable: "--font-telugu", subsets: ["telugu"] });

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { default: `${dict.brand} · ${dict.tagline}`, template: `%s · ${dict.brand}` },
    description: dict.home.heroBody,
  };
}

export const viewport: Viewport = { themeColor: "#0f5132" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary();

  return (
    <html lang={lang} className={`${notoSans.variable} ${notoTelugu.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href={`/${lang}`} className="text-lg font-bold text-brand">
              {dict.brand}
            </Link>
            <Link href={`/${lang}/listings`} className="text-sm hover:underline">
              {dict.nav.search}
            </Link>
            <Link href={`/${lang}/dashboard`} className="text-sm hover:underline">
              {dict.nav.brokers}
            </Link>
            <span className="ml-auto" />
            <Suspense>
              <LanguageSwitch current={lang} label={dict.switchTo} />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line px-4 py-6 text-center text-sm text-muted">{dict.footer}</footer>
      </body>
    </html>
  );
}
