import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ListingCard } from "@/components/listing-card";
import { whatsappLink } from "@/lib/format";
import { getBroker, getLocality, listingsByBroker } from "@/lib/repository";

export async function generateMetadata({ params }: PageProps<"/[lang]/agent/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const broker = getBroker(slug);
  if (!broker) return {};
  const count = listingsByBroker(slug).length;
  const description = `${broker.displayName} · ${count} live listings`;
  return { title: broker.displayName, description, openGraph: { title: broker.displayName, description } };
}

// Public broker profile: works as the broker's own website and shows only their listings.
export default async function AgentPage({ params }: PageProps<"/[lang]/agent/[slug]">) {
  const { slug } = await params;
  const lang = await getLocale();
  const dict = await getDictionary();
  const broker = getBroker(slug);
  if (!broker) notFound();
  const own = listingsByBroker(slug);

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
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <a
            href={whatsappLink(broker.phone, `Hi ${broker.displayName}, I found you on Chirunama.`)}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {own.map((l) => (
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
