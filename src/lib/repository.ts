import { brokers, cities, leads, listingStats, listings, localities, supportPhone } from "./sample-data";
import type { Badge, Category, Furnishing, Listing, Locality, PlotDocument } from "./types";

// Read-side repository. Backed by sample data until the Postgres database is provisioned;
// each function maps one-to-one onto a Prisma query against prisma/schema.prisma.

export type ListingFilters = {
  category?: Category;
  locality?: string;
  minPrice?: number;
  maxPrice?: number;
  bhk?: number;
  furnishing?: Furnishing;
  ownerOnly?: boolean;
  verifiedOnly?: boolean;
};

const CATEGORIES: Category[] = ["RENTAL", "SALE", "PLOT", "COMMERCIAL"];
const FURNISHINGS: Furnishing[] = ["UNFURNISHED", "SEMI", "FULL"];

function toInt(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseFilters(params: Record<string, string | string[] | undefined>): ListingFilters {
  const category = typeof params.category === "string" ? params.category.toUpperCase() : undefined;
  const furnishing = typeof params.furnishing === "string" ? params.furnishing.toUpperCase() : undefined;
  return {
    category: CATEGORIES.find((c) => c === category),
    locality: typeof params.locality === "string" && params.locality ? params.locality : undefined,
    minPrice: toInt(params.minPrice),
    maxPrice: toInt(params.maxPrice),
    bhk: toInt(params.bhk),
    furnishing: FURNISHINGS.find((f) => f === furnishing),
    ownerOnly: params.ownerOnly === "1",
    verifiedOnly: params.verifiedOnly === "1",
  };
}

export const PLOT_DOCUMENTS: PlotDocument[] = ["TITLE", "ENCUMBRANCE", "LAYOUT_APPROVAL"];

export function hasBadge(listing: Listing, badge: Badge): boolean {
  return listing.badges.some((b) => b.type === badge);
}

// Plots are promoted only after the advocate has checked their documents.
export function isPromotable(listing: Listing): boolean {
  return listing.status === "LIVE" && (listing.category !== "PLOT" || hasBadge(listing, "DOCUMENTS_CHECKED"));
}

// Search shows only live listings; expired ones come back when the lister re-confirms them.
export function searchListings(filters: ListingFilters): Listing[] {
  return listings
    .filter((l) => l.status === "LIVE")
    .filter((l) => !filters.category || l.category === filters.category)
    .filter((l) => !filters.locality || l.localitySlug === filters.locality)
    .filter((l) => filters.minPrice === undefined || l.price >= filters.minPrice)
    .filter((l) => filters.maxPrice === undefined || l.price <= filters.maxPrice)
    .filter((l) => filters.bhk === undefined || l.bhk === filters.bhk)
    .filter((l) => !filters.furnishing || l.furnishing === filters.furnishing)
    .filter((l) => !filters.ownerOnly || l.listerType === "OWNER")
    .filter((l) => !filters.verifiedOnly || l.badges.length > 0)
    .sort((a, b) => b.lastConfirmedAt.localeCompare(a.lastConfirmedAt));
}

export function promotedListings(filters: ListingFilters = {}): Listing[] {
  return searchListings(filters).filter(isPromotable);
}

export function getListing(code: string) {
  return listings.find((l) => l.code.toLowerCase() === code.toLowerCase());
}

export function getBroker(slug: string) {
  return brokers.find((b) => b.slug === slug);
}

// Public pages show live listings only; the broker's own dashboard also sees expired ones.
export function listingsByBroker(slug: string, { includeExpired = false } = {}) {
  return listings.filter((l) => l.brokerSlug === slug && (includeExpired || l.status === "LIVE"));
}

export function getLocality(slug: string) {
  return localities.find((l) => l.slug === slug);
}

export function allLocalities() {
  return localities;
}

export function allBrokers() {
  return brokers;
}

export function allListings() {
  return listings;
}

export function getCity(slug: string) {
  return cities.find((c) => c.slug === slug);
}

export function leadsForBroker(slug: string) {
  const codes = new Set(listingsByBroker(slug, { includeExpired: true }).map((l) => l.code));
  return leads.filter((l) => codes.has(l.listingCode)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function statsFor(code: string) {
  return listingStats.find((s) => s.code === code) ?? { code, views: 0, saves: 0 };
}

// The locality average a listing's price is compared against: rent per month, sale price per
// sq. ft or plot price per sq. yd. Commercial has no average yet.
export function localityAverage(
  listing: Listing,
  locality: Locality | undefined,
): { amount: number; unit: "month" | "sqft" | "sqyd" } | undefined {
  if (!locality) return undefined;
  if (listing.category === "RENTAL" && locality.avgRentPerMonth) return { amount: locality.avgRentPerMonth, unit: "month" };
  if (listing.category === "SALE" && locality.avgSalePerSqft) return { amount: locality.avgSalePerSqft, unit: "sqft" };
  if (listing.category === "PLOT" && locality.avgPlotPerSqyd) return { amount: locality.avgPlotPerSqyd, unit: "sqyd" };
  return undefined;
}

export function supportContact() {
  return supportPhone;
}
