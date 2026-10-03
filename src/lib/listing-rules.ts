import type { Badge, Category, Furnishing, Listing, Locality, PlotDocument } from "./types";

// Pure listing rules shared by the repository, pages and tests. No database access here.

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

// Postgres integers are 32-bit; anything larger is not a meaningful price or BHK filter.
const MAX_INT = 2_147_483_647;

function toInt(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 && n <= MAX_INT ? n : undefined;
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
