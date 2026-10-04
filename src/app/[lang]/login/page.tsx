import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { afterSignInPath } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.login.title, robots: { index: false } };
}

// Phone sign-in. `next` is where to go afterwards; only same-site paths are honoured.
export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const lang = await getLocale();
  const dict = await getDictionary();
  const { next: raw } = await searchParams;
  const next = afterSignInPath(typeof raw === "string" ? raw : undefined, lang);

  if (await getSession()) redirect(next);

  const labels = {
    ...dict.login,
    codeSent: dict.login.codeSent("{p}"),
    devCode: dict.login.devCode("{c}"),
  };

  return (
    <div className="py-6">
      <LoginForm lang={lang} next={next} labels={labels} />
    </div>
  );
}
