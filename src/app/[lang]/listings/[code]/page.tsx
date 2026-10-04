import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { BadgeList } from "@/components/badge-list";
import { formatPrice, formatRupees, whatsappLink } from "@/lib/format";
import { PLOT_DOCUMENTS, hasBadge } from "@/lib/listing-rules";
import { getBroker, getListing as loadListing, supportContact } from "@/lib/repository";

// One query per request, shared by the metadata and the page.
const getListing = cache(loadListing);

export async function generateMetadata({ params }: PageProps<"/[lang]/listings/[code]">): Promise<Metadata> {
  const { code } = await params;
  const lang = await getLocale();
  const listing = await getListing(code);
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
  const listing = await getListing(code);
  if (!listing) notFound();

  const [broker, support] = await Promise.all([
    listing.brokerSlug ? getBroker(listing.brokerSlug) : undefined,
    supportContact(),
  ]);
  const monthly = listing.category === "RENTAL" || listing.category === "COMMERCIAL";
  const enquiry = dict.listing.enquiry(listing.code);
  const documentsChecked = hasBadge(listing, "DOCUMENTS_CHECKED");
  const received = new Set(listing.documentsReceived ?? []);

  return (
    <article className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4">
        {listing.status === "EXPIRED" && (
          <p className="rounded-lg border border-accent px-3 py-2 text-sm text-accent">{dict.listing.expired}</p>
        )}
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-brand-soft text-muted">
          {listing.code}
        </div>
        <h1 className="text-2xl font-bold">{listing.title[lang]}</h1>
        <p className="text-muted">
          {listing.localityName[lang]} · {dict.categories[listing.category]}
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
          <BadgeList badges={listing.badges} labels={dict.badges} detail={dict.badgeDetail} />
          {listing.category === "PLOT" && !documentsChecked ? (
            <p className="text-sm text-accent">{dict.listing.plotUnchecked}</p>
          ) : (
            listing.badges.length === 0 && <p className="text-sm text-accent">{dict.listing.noChecks}</p>
          )}
        </section>

        {listing.category === "PLOT" && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{dict.listing.documents}</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {PLOT_DOCUMENTS.map((doc) => {
                const status = documentsChecked
                  ? dict.listing.docChecked
                  : received.has(doc)
                    ? dict.listing.docReceived
                    : dict.listing.docMissing;
                return (
                  <li key={doc} className="flex justify-between gap-4 border-b border-line py-1 last:border-0">
                    <span>{dict.listing.docs[doc]}</span>
                    <span className={documentsChecked ? "text-brand" : "text-muted"}>{status}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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
        {listing.status === "LIVE" && (
          <a
            href={whatsappLink(listing.ownerPhone, dict.listing.visitRequest(listing.code))}
            className="rounded-lg border border-line px-3 py-2 text-center"
          >
            {dict.listing.bookVisit}
          </a>
        )}
        {listing.listerType === "OWNER" && !listing.allowBrokerContact && (
          <p className="text-xs text-muted">{dict.listing.noBrokers}</p>
        )}
        <p className="text-xs text-muted">
          {dict.listing.confirmed} {listing.lastConfirmedAt}
        </p>
        <a
          href={whatsappLink(support, dict.listing.reportText(listing.code))}
          className="text-xs text-muted underline hover:text-accent"
        >
          {dict.listing.report}
        </a>
      </aside>
    </article>
  );
}
