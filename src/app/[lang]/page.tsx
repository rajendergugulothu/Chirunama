import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ListingCard } from "@/components/listing-card";
import { allLocalities, promotedListings } from "@/lib/repository";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = ["RENTAL", "SALE", "PLOT", "COMMERCIAL"];

export default async function Home() {
  const lang = await getLocale();
  const dict = await getDictionary();
  const latest = promotedListings().slice(0, 3);
  const checkedPlots = promotedListings({ category: "PLOT" }).slice(0, 3);
  const labels = { perMonth: dict.listing.perMonth, lister: dict.lister, badges: dict.badges };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3 py-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{dict.home.heroTitle}</h1>
        <p className="max-w-2xl text-muted">{dict.home.heroBody}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.home.browse}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/${lang}/listings?category=${c.toLowerCase()}`}
              className="rounded-xl border border-line bg-surface p-4 text-center font-medium hover:border-brand"
            >
              {dict.categories[c]}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.home.localities}</h2>
        <div className="flex flex-wrap gap-2">
          {allLocalities().map((l) => (
            <Link
              key={l.slug}
              href={`/${lang}/locality/${l.slug}`}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-brand"
            >
              {l.name[lang]}
            </Link>
          ))}
        </div>
      </section>

      {checkedPlots.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">{dict.home.checkedPlots}</h2>
            <p className="text-sm text-muted">{dict.home.checkedPlotsBody}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {checkedPlots.map((l) => (
              <ListingCard key={l.code} listing={l} lang={lang} labels={labels} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.home.latest}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((l) => (
            <ListingCard key={l.code} listing={l} lang={lang} labels={labels} />
          ))}
        </div>
      </section>
    </div>
  );
}
