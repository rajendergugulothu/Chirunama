import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireRole } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.title, robots: { index: false } };
}

// Admin home. Users without ADMIN get a 404, so the area's existence stays hidden.
export default async function AdminPage() {
  const lang = await getLocale();
  await requireRole("ADMIN", `/${lang}/admin`);
  const dict = await getDictionary();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{dict.admin.title}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/${lang}/admin/outbox`}
          className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 hover:border-brand"
        >
          <span className="font-semibold">{dict.admin.outbox}</span>
          <span className="text-sm text-muted">{dict.admin.outboxHint}</span>
        </Link>
      </div>
    </div>
  );
}
