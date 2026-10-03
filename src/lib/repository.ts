import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Prisma } from "@/generated/prisma/client";
import type { ListingFilters } from "./listing-rules";
import { toBroker, toLead, toListing, toLocality } from "./mappers";
import type { Broker, Lead, Listing, Locality } from "./types";

// Read-side repository: Prisma queries against Postgres, returned as the view types in
// src/lib/types.ts. Pages never see database rows.

const PUBLIC_STATUSES = ["LIVE", "EXPIRED"] as const;
const SEARCH_LIMIT = 100;

const listingSelect = {
  code: true,
  category: true,
  listerType: true,
  status: true,
  titleEn: true,
  titleTe: true,
  descriptionEn: true,
  descriptionTe: true,
  price: true,
  deposit: true,
  furnishing: true,
  details: true,
  photos: true,
  allowBrokerContact: true,
  availableFrom: true,
  lastConfirmedAt: true,
  unit: {
    select: {
      type: true,
      bhk: true,
      areaSqft: true,
      areaSqyd: true,
      property: { select: { locality: { select: { slug: true, nameEn: true, nameTe: true } } } },
    },
  },
  lister: {
    select: {
      phone: true,
      brokerProfile: { select: { slug: true, verifiedAt: true, verifiedBy: true } },
    },
  },
  verifications: {
    select: {
      type: true,
      result: true,
      reviewer: true,
      checkedAt: true,
      createdAt: true,
      documents: { select: { kind: true } },
    },
  },
} satisfies Prisma.ListingSelect;

const localitySelect = {
  slug: true,
  nameEn: true,
  nameTe: true,
  avgRentPerMonth: true,
  avgSalePerSqft: true,
  avgPlotPerSqyd: true,
  city: { select: { slug: true } },
} satisfies Prisma.LocalitySelect;

const brokerSelect = {
  userId: true,
  slug: true,
  displayName: true,
  agencyName: true,
  yearsExperience: true,
  languages: true,
  reraNumber: true,
  plan: true,
  verifiedAt: true,
  user: { select: { phone: true } },
  localities: { select: { slug: true }, orderBy: { nameEn: "asc" } },
} satisfies Prisma.BrokerProfileSelect;

const listingOrder: Prisma.ListingOrderByWithRelationInput[] = [{ lastConfirmedAt: "desc" }, { number: "desc" }];

// A check on the listing itself, or a lister whose broker profile is verified.
const verifiedWhere: Prisma.ListingWhereInput = {
  OR: [
    { verifications: { some: { result: "PASSED", type: { not: "VERIFIED_BROKER" } } } },
    { lister: { brokerProfile: { is: { verifiedAt: { not: null } } } } },
  ],
};

function searchWhere(filters: ListingFilters): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [{ status: "LIVE" }];
  if (filters.category) and.push({ category: filters.category });
  if (filters.locality) and.push({ unit: { property: { locality: { slug: filters.locality } } } });
  if (filters.minPrice !== undefined) and.push({ price: { gte: filters.minPrice } });
  if (filters.maxPrice !== undefined) and.push({ price: { lte: filters.maxPrice } });
  if (filters.bhk !== undefined) and.push({ unit: { bhk: filters.bhk } });
  if (filters.furnishing) and.push({ furnishing: filters.furnishing });
  if (filters.ownerOnly) and.push({ listerType: "OWNER" });
  if (filters.verifiedOnly) and.push(verifiedWhere);
  return { AND: and };
}

// Search shows only live listings; expired ones come back when the lister re-confirms them.
export async function searchListings(filters: ListingFilters): Promise<Listing[]> {
  const rows = await prisma.listing.findMany({
    where: searchWhere(filters),
    orderBy: listingOrder,
    take: SEARCH_LIMIT,
    select: listingSelect,
  });
  return rows.map(toListing);
}

// Plots are promoted only after the advocate has checked their documents.
export async function promotedListings(filters: ListingFilters = {}): Promise<Listing[]> {
  const rows = await prisma.listing.findMany({
    where: {
      AND: [
        searchWhere(filters),
        {
          OR: [
            { category: { not: "PLOT" } },
            { verifications: { some: { type: "DOCUMENTS_CHECKED", result: "PASSED" } } },
          ],
        },
      ],
    },
    orderBy: listingOrder,
    take: SEARCH_LIMIT,
    select: listingSelect,
  });
  return rows.map(toListing);
}

// Public detail page: LIVE or EXPIRED only. Codes are matched case-insensitively.
export async function getListing(code: string): Promise<Listing | undefined> {
  const row = await prisma.listing.findFirst({
    where: { code: code.toUpperCase(), status: { in: [...PUBLIC_STATUSES] } },
    select: listingSelect,
  });
  return row ? toListing(row) : undefined;
}

type BrokerProfileRow = Prisma.BrokerProfileGetPayload<{ select: typeof brokerSelect }>;

async function withResponseTimes(row: BrokerProfileRow): Promise<Broker> {
  const responseTimes = await prisma.lead.findMany({
    where: { listing: { listerId: row.userId }, contactedAt: { not: null } },
    select: { createdAt: true, contactedAt: true },
  });
  return toBroker(row, responseTimes);
}

export async function getBroker(slug: string): Promise<Broker | undefined> {
  const row = await prisma.brokerProfile.findUnique({ where: { slug }, select: brokerSelect });
  return row ? withResponseTimes(row) : undefined;
}

export async function getBrokerForUser(userId: string): Promise<Broker | null> {
  const row = await prisma.brokerProfile.findUnique({ where: { userId }, select: brokerSelect });
  return row ? withResponseTimes(row) : null;
}

// Public pages show live listings only; the broker's own dashboard also sees expired ones.
export async function listingsByBroker(slug: string, { includeExpired = false } = {}): Promise<Listing[]> {
  const rows = await prisma.listing.findMany({
    where: {
      lister: { brokerProfile: { is: { slug } } },
      status: includeExpired ? { in: [...PUBLIC_STATUSES] } : "LIVE",
    },
    orderBy: listingOrder,
    select: listingSelect,
  });
  return rows.map(toListing);
}

export async function getLocality(slug: string): Promise<Locality | undefined> {
  const row = await prisma.locality.findUnique({ where: { slug }, select: localitySelect });
  return row ? toLocality(row) : undefined;
}

export async function allLocalities(): Promise<Locality[]> {
  const rows = await prisma.locality.findMany({ orderBy: { nameEn: "asc" }, select: localitySelect });
  return rows.map(toLocality);
}

// Leads on any of the broker's listings, newest first. Contains enquirers' phone numbers:
// only for that broker's own dashboard.
export async function leadsForBroker(slug: string): Promise<Lead[]> {
  const rows = await prisma.lead.findMany({
    where: { listing: { lister: { brokerProfile: { is: { slug } } } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      enquirerName: true,
      enquirerPhone: true,
      enquirer: { select: { name: true, phone: true } },
      source: true,
      stage: true,
      createdAt: true,
      visitAt: true,
      listing: { select: { code: true } },
    },
  });
  return rows.map(toLead);
}

// Views and saves (favourites) per listing code. Codes that do not exist get zeros.
export async function listingStats(codes: string[]): Promise<Map<string, { views: number; saves: number }>> {
  const rows = await prisma.listing.findMany({
    where: { code: { in: codes } },
    select: { code: true, views: true, _count: { select: { favorites: true } } },
  });
  const stats = new Map(codes.map((code) => [code, { views: 0, saves: 0 }]));
  for (const row of rows) stats.set(row.code, { views: row.views, saves: row._count.favorites });
  return stats;
}

// Where one-tap listing reports and "message us" links go.
export async function supportContact(): Promise<string> {
  return env().SUPPORT_WHATSAPP;
}
