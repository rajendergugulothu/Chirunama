import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ListingCard } from "@/components/listing-card";
import { allLocalities, parseFilters, searchListings } from "@/lib/repository";
import type { Category, Furnishing } from "@/lib/types";

const CATEGORIES: Category[] = ["RENTAL", "SALE", "PLOT", "COMMERCIAL"];
const FURNISHINGS: Furnishing[] = ["UNFURNISHED", "SEMI", "FULL"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.nav.search };
}

export default async function ListingsPage({ searchParams }: PageProps<"/[lang]/listings">) {
  const lang = await getLocale();
  const dict = await getDictionary();
  const filters = parseFilters(await searchParams);
  const results = searchListings(filters);
  const field = "rounded-lg border border-line bg-surface px-2 py-1.5";

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <form className="flex flex-col gap-3 text-sm" method="get">
        <h1 className="text-lg font-semibold">{dict.filters.title}</h1>
        <label className="flex flex-col gap-1">
          {dict.filters.category}
          <select name="category" defaultValue={filters.category?.toLowerCase() ?? ""} className={field}>
            <option value="">{dict.filters.any}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {dict.categories[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {dict.filters.locality}
          <select name="locality" defaultValue={filters.locality ?? ""} className={field}>
            <option value="">{dict.filters.any}</option>
            {allLocalities().map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name[lang]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            {dict.filters.minPrice}
            <input name="minPrice" type="number" min={0} defaultValue={filters.minPrice} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            {dict.filters.maxPrice}
            <input name="maxPrice" type="number" min={0} defaultValue={filters.maxPrice} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          {dict.filters.bhk}
          <select name="bhk" defaultValue={filters.bhk?.toString() ?? ""} className={field}>
            <option value="">{dict.filters.any}</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {dict.filters.furnishing}
          <select name="furnishing" defaultValue={filters.furnishing?.toLowerCase() ?? ""} className={field}>
            <option value="">{dict.filters.any}</option>
            {FURNISHINGS.map((f) => (
              <option key={f} value={f.toLowerCase()}>
                {dict.furnishing[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="ownerOnly" value="1" defaultChecked={filters.ownerOnly} />
          {dict.filters.ownerOnly}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="verifiedOnly" value="1" defaultChecked={filters.verifiedOnly} />
          {dict.filters.verifiedOnly}
        </label>
        <button type="submit" className="rounded-lg bg-brand px-3 py-2 font-medium text-surface">
          {dict.filters.apply}
        </button>
      </form>

      <section className="flex flex-col gap-4">
        <p className="text-sm text-muted">{dict.filters.results(results.length)}</p>
        {results.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-muted">{dict.filters.none}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((l) => (
              <ListingCard
                key={l.code}
                listing={l}
                lang={lang}
                labels={{ perMonth: dict.listing.perMonth, lister: dict.lister, badges: dict.badges }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
