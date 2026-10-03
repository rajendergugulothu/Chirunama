import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ListingCard } from "@/components/listing-card";
import { whatsappLink } from "@/lib/format";
import { getBroker, getLocality, hasBadge, isPromotable, listingsByBroker, parseFilters } from "@/lib/repository";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = ["RENTAL", "SALE", "PLOT", "COMMERCIAL"];

export async function generateMetadata({ params }: PageProps<"/[lang]/agent/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const broker = getBroker(slug);
  if (!broker) return {};
  const lang = await getLocale();
  const own = listingsByBroker(slug);
  // Rich link preview: name, live listing count and a featured property.
  const featured = own.find(isPromotable);
  const description = [`${broker.displayName} · ${own.length} live listings`, featured?.title[lang]].filter(Boolean).join(" · ");
  return { title: broker.displayName, description, openGraph: { title: broker.displayName, description } };
}

// Public broker profile: works as the broker's own website and shows only their listings.
export default async function AgentPage({ params, searchParams }: PageProps<"/[lang]/agent/[slug]">) {
  const { slug } = await params;
  const { category } = parseFilters(await searchParams);
  const lang = await getLocale();
  const dict = await getDictionary();
  const broker = getBroker(slug);
  if (!broker) notFound();
  const own = listingsByBroker(slug);
  const shown = category ? own.filter((l) => l.category === category) : own;
  const checked = own.filter((l) => hasBadge(l, "DOCUMENTS_CHECKED")).length;
  const offered = CATEGORIES.filter((c) => own.some((l) => l.category === c));
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:border-brand"}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-bold text-brand">
          {broker.displayName.charAt(0)}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold">{broker.displayName}</h1>
          <p className="text-sm text-muted">
            {dict.broker.experience(broker.yearsExperience)}
            {broker.reraNumber && ` · ${dict.broker.rera} ${broker.reraNumber}`}
          </p>
          <p className="text-sm">
            {dict.broker.serves}: {broker.localitySlugs.map((s) => getLocality(s)?.name[lang]).join(", ")}
          </p>
          <div className="flex flex-wrap gap-1">
            {broker.verified && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                ✓ {dict.badges.VERIFIED_BROKER}
              </span>
            )}
            {broker.avgResponseMinutes && (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs">
                {dict.broker.responds(broker.avgResponseMinutes)}
              </span>
            )}
            {checked > 0 && (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs">{dict.broker.checkedListings(checked)}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <a
            href={whatsappLink(broker.phone, dict.broker.hello(broker.displayName))}
            className="rounded-lg bg-brand px-4 py-2 text-center font-medium text-surface"
          >
            {dict.listing.whatsapp}
          </a>
          <a href={`tel:+${broker.phone}`} className="rounded-lg border border-line px-4 py-2 text-center">
            {dict.listing.call}
          </a>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {dict.broker.listings} ({own.length})
        </h2>
        {offered.length > 1 && (
          <nav className="flex flex-wrap gap-2">
            <Link href={`/${lang}/agent/${slug}`} className={chip(!category)}>
              {dict.broker.all}
            </Link>
            {offered.map((c) => (
              <Link key={c} href={`/${lang}/agent/${slug}?category=${c.toLowerCase()}`} className={chip(category === c)}>
                {dict.categories[c]}
              </Link>
            ))}
          </nav>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((l) => (
            <ListingCard
              key={l.code}
              listing={l}
              lang={lang}
              labels={{ perMonth: dict.listing.perMonth, lister: dict.lister, badges: dict.badges }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
