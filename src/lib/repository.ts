import { brokers, cities, listings, localities } from "./sample-data";
import type { Category, Furnishing, Listing } from "./types";

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

export function searchListings(filters: ListingFilters): Listing[] {
  return listings
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

export function getListing(code: string) {
  return listings.find((l) => l.code.toLowerCase() === code.toLowerCase());
}

export function getBroker(slug: string) {
  return brokers.find((b) => b.slug === slug);
}

export function listingsByBroker(slug: string) {
  return listings.filter((l) => l.brokerSlug === slug);
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
