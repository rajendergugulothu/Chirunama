import Link from "next/link";
import type { Locale } from "@/i18n/dictionaries";
import { formatPrice } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { BadgeList } from "./badge-list";

type Labels = {
  perMonth: string;
  lister: Record<Listing["listerType"], string>;
  badges: Record<string, string>;
};

export function ListingCard({ listing, lang, labels }: { listing: Listing; lang: Locale; labels: Labels }) {
  const monthly = listing.category === "RENTAL" || listing.category === "COMMERCIAL";

  return (
    <Link
      href={`/${lang}/listings/${listing.code}`}
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition hover:border-brand"
    >
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-brand-soft text-sm text-muted">
        {listing.code}
      </div>
      <div className="text-lg font-semibold">
        {formatPrice(listing.price, listing.category)}
        {monthly && <span className="text-sm font-normal text-muted"> {labels.perMonth}</span>}
      </div>
      <div className="line-clamp-2">{listing.title[lang]}</div>
      <div className="text-sm text-muted">
        {listing.localityName[lang]} · {labels.lister[listing.listerType]}
      </div>
      <BadgeList badges={listing.badges} labels={labels.badges} compact />
    </Link>
  );
}
