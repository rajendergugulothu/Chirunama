import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { BadgeList } from "@/components/badge-list";
import { formatPrice, formatRupees, whatsappLink } from "@/lib/format";
import { getBroker, getListing, getLocality } from "@/lib/repository";

export async function generateMetadata({ params }: PageProps<"/[lang]/listings/[code]">): Promise<Metadata> {
  const { code } = await params;
  const lang = await getLocale();
  const listing = getListing(code);
  if (!listing) return {};
  // Rich link previews for WhatsApp, Instagram and Facebook shares.
  return {
    title: listing.title[lang],
    description: listing.description[lang],
    openGraph: { title: listing.title[lang], description: listing.description[lang] },
  };
}

export default async function ListingPage({ params }: PageProps<"/[lang]/listings/[code]">) {
  const { code } = await params;
  const lang = await getLocale();
  const dict = await getDictionary();
  const listing = getListing(code);
  if (!listing) notFound();

  const locality = getLocality(listing.localitySlug);
  const broker = listing.brokerSlug ? getBroker(listing.brokerSlug) : undefined;
  const monthly = listing.category === "RENTAL" || listing.category === "COMMERCIAL";
  const enquiry = dict.listing.enquiry(listing.code);

  return (
    <article className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4">
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-brand-soft text-muted">
          {listing.code}
        </div>
        <h1 className="text-2xl font-bold">{listing.title[lang]}</h1>
        <p className="text-muted">
          {locality?.name[lang]} · {dict.categories[listing.category]}
        </p>
        <p>{listing.description[lang]}</p>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{dict.listing.details}</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {listing.deposit !== undefined && (
              <>
                <dt className="text-muted">{dict.listing.deposit}</dt>
                <dd>{formatRupees(listing.deposit)}</dd>
              </>
            )}
            {listing.areaSqft !== undefined && (
              <>
                <dt className="text-muted">{dict.listing.area}</dt>
                <dd>
                  {listing.areaSqft} {dict.listing.sqft}
                </dd>
              </>
            )}
            {listing.areaSqyd !== undefined && (
              <>
                <dt className="text-muted">{dict.listing.area}</dt>
                <dd>
                  {listing.areaSqyd} {dict.listing.sqyd}
                </dd>
              </>
            )}
            {listing.furnishing && (
              <>
                <dt className="text-muted">{dict.filters.furnishing}</dt>
                <dd>{dict.furnishing[listing.furnishing]}</dd>
              </>
            )}
            {listing.availableFrom && (
              <>
                <dt className="text-muted">{dict.listing.availableFrom}</dt>
                <dd>{listing.availableFrom}</dd>
              </>
            )}
            {Object.entries(listing.details).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted">{key.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
            <dt className="text-muted">{dict.listing.code}</dt>
            <dd>{listing.code}</dd>
          </dl>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{dict.listing.trust}</h2>
          {listing.badges.length === 0 ? (
            <p className="text-sm text-accent">{dict.listing.noChecks}</p>
          ) : (
            <BadgeList badges={listing.badges} labels={dict.badges} detail={dict.badgeDetail} />
          )}
        </section>
      </div>

      <aside className="flex h-fit flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:sticky md:top-4">
        <div className="text-2xl font-bold">
          {formatPrice(listing.price, listing.category)}
          {monthly && <span className="text-sm font-normal text-muted"> {dict.listing.perMonth}</span>}
        </div>
        <div className="text-sm">
          {dict.listing.listedBy}:{" "}
          {broker ? (
            <Link href={`/${lang}/agent/${broker.slug}`} className="font-medium text-brand hover:underline">
              {broker.displayName}
            </Link>
          ) : (
            dict.lister.OWNER
          )}
        </div>
        <a
          href={whatsappLink(listing.ownerPhone, enquiry)}
          className="rounded-lg bg-brand px-3 py-2 text-center font-medium text-surface"
        >
          {dict.listing.whatsapp}
        </a>
        <a href={`tel:+${listing.ownerPhone}`} className="rounded-lg border border-line px-3 py-2 text-center">
          {dict.listing.call}
        </a>
        <p className="text-xs text-muted">
          {dict.listing.confirmed} {listing.lastConfirmedAt}
        </p>
      </aside>
    </article>
  );
}
