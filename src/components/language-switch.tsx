"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// One-tap Telugu/English switch that keeps the reader on the same page and filters.
export function LanguageSwitch({ current, label }: { current: string; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const other = current === "te" ? "en" : "te";
  const rest = pathname.replace(/^\/(te|en)(?=\/|$)/, "");
  const query = searchParams.toString();

  return (
    <Link
      href={`/${other}${rest}${query ? `?${query}` : ""}`}
      className="rounded-full border border-line px-3 py-1 text-sm hover:bg-brand-soft"
      lang={other}
    >
      {label}
    </Link>
  );
}
