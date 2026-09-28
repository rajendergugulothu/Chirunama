import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ListingCard } from "@/components/listing-card";
import { formatRupees } from "@/lib/format";
import { allLocalities, getLocality, searchListings } from "@/lib/repository";

export function generateStaticParams() {
  return allLocalities().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/locality/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLocale();
  const locality = getLocality(slug);
  return locality ? { title: locality.name[lang] } : {};
}

// Locality pages: average prices plus live listings, and a source of free search traffic.
export default async function LocalityPage({ params }: PageProps<"/[lang]/locality/[slug]">) {
  const { slug } = await params;
  const lang = await getLocale();
  const dict = await getDictionary();
  const locality = getLocality(slug);
  if (!locality) notFound();
  const live = searchListings({ locality: slug });

  const stats = [
    locality.avgRentPerMonth && { label: dict.locality.avgRent, value: `${formatRupees(locality.avgRentPerMonth)} ${dict.listing.perMonth}` },
    locality.avgSalePerSqft && { label: dict.locality.avgSale, value: `${formatRupees(locality.avgSalePerSqft)} ${dict.locality.perSqft}` },
    locality.avgPlotPerSqyd && { label: dict.locality.avgPlot, value: `${formatRupees(locality.avgPlotPerSqyd)} ${dict.locality.perSqyd}` },
  ].filter((s): s is { label: string; value: string } => Boolean(s));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">{locality.name[lang]}</h1>
      <section className="flex flex-col gap-2">
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-surface p-4">
              <div className="text-sm text-muted">{s.label}</div>
              <div className="text-xl font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">{dict.locality.sample}</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {dict.locality.live} ({live.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((l) => (
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
