"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Sign in" that brings the reader back to the page they were on.
export function SignInLink({ lang, label }: { lang: string; label: string }) {
  const pathname = usePathname();
  const login = `/${lang}/login`;
  const onLogin = pathname === login || pathname.startsWith(`${login}/`);
  const href = onLogin ? login : `${login}?next=${encodeURIComponent(pathname)}`;

  return (
    <Link href={href} className="shrink-0 rounded-full bg-brand px-3 py-1 text-sm font-medium text-surface">
      {label}
    </Link>
  );
}
