import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { signOutAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";
import { maskPhone } from "@/lib/phone";
import { hasBrokerProfile } from "@/lib/repository";
import { NavMenu } from "./nav-menu";
import { SignInLink } from "./sign-in-link";

// The header's account corner: "Sign in" for visitors, otherwise a menu named after the
// user, or their own number masked.
export async function UserMenu({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const session = await getSession();
  if (!session) return <SignInLink lang={lang} label={dict.nav.signIn} />;

  const { user } = session;
  const isBroker = await hasBrokerProfile(user.id);
  const isAdmin = user.roles.includes("ADMIN");
  const label = user.name ?? maskPhone(user.phone);
  const item = "px-4 py-2 text-left hover:bg-brand-soft";

  // Phones get an icon (the label is read out, and shown at the top of the menu); wider
  // screens show the label itself.
  return (
    <NavMenu
      summary={
        <>
          <span className="sr-only">{dict.nav.account}: </span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-5 text-brand sm:hidden">
            <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" />
          </svg>
          <span className="sr-only sm:hidden">{label}</span>
          <span className="hidden max-w-40 truncate tabular-nums sm:block">{label}</span>
        </>
      }
    >
      <p className="truncate border-b border-line px-4 py-2 text-muted tabular-nums sm:hidden">{label}</p>
      {isBroker && (
        <Link href={`/${lang}/dashboard`} className={item}>
          {dict.nav.dashboard}
        </Link>
      )}
      {isAdmin && (
        <Link href={`/${lang}/admin`} className={item}>
          {dict.nav.admin}
        </Link>
      )}
      <form action={signOutAction} className="flex flex-col">
        <input type="hidden" name="lang" value={lang} />
        <button type="submit" className={item}>
          {dict.nav.signOut}
        </button>
      </form>
    </NavMenu>
  );
}
