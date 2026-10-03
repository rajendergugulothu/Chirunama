import { PLOT_DOCUMENTS } from "./listing-rules";
import type {
  Badge,
  BadgeCheck,
  Broker,
  BrokerPlan,
  Category,
  Furnishing,
  Lead,
  LeadSource,
  LeadStage,
  ListerType,
  Listing,
  Locality,
} from "./types";

// Pure row-to-view mappers. The row types list only the columns each mapper reads, so the
// repository's Prisma `select`s must provide them and tests can build rows by hand.

type VerificationType = Badge;
type VerificationResult = "PENDING" | "PASSED" | "FAILED";

export type LocalityRow = {
  slug: string;
  nameEn: string;
  nameTe: string;
  avgRentPerMonth: number | null;
  avgSalePerSqft: number | null;
  avgPlotPerSqyd: number | null;
  city: { slug: string };
};

export type ListingRow = {
  code: string;
  category: Category;
  listerType: ListerType;
  status: string;
  titleEn: string;
  titleTe: string;
  descriptionEn: string | null;
  descriptionTe: string | null;
  price: number;
  deposit: number | null;
  furnishing: Furnishing | null;
  details: unknown;
  photos: string[];
  allowBrokerContact: boolean;
  availableFrom: Date | null;
  lastConfirmedAt: Date;
  unit: {
    type: string;
    bhk: number | null;
    areaSqft: number | null;
    areaSqyd: number | null;
    property: { locality: { slug: string; nameEn: string; nameTe: string } };
  };
  lister: {
    phone: string;
    brokerProfile: { slug: string; verifiedAt: Date | null; verifiedBy: string | null } | null;
  };
  verifications: {
    type: VerificationType;
    result: VerificationResult;
    reviewer: string | null;
    checkedAt: Date | null;
    createdAt: Date;
    documents: { kind: string }[];
  }[];
};

export type BrokerRow = {
  slug: string;
  displayName: string;
  agencyName: string | null;
  yearsExperience: number | null;
  languages: ("TE" | "EN")[];
  reraNumber: string | null;
  plan: BrokerPlan;
  verifiedAt: Date | null;
  user: { phone: string };
  localities: { slug: string }[];
};

export type ResponseTimeRow = { createdAt: Date; contactedAt: Date | null };

export type LeadRow = {
  id: string;
  enquirerName: string | null;
  enquirerPhone: string | null;
  enquirer: { name: string | null; phone: string } | null;
  source: LeadSource;
  stage: LeadStage;
  createdAt: Date;
  visitAt: Date | null;
  listing: { code: string };
};

const indiaDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Calendar date in India as YYYY-MM-DD, whatever the server's timezone.
export function isoDate(date: Date): string {
  const parts = Object.fromEntries(indiaDate.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

// Category-specific details are JSON; only flat string, number and boolean values are shown.
export function toDetails(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
  }
  return out;
}

// VERIFIED_BROKER comes from the lister's broker profile; the other badges are passed checks on
// the listing, one per type (the latest check wins), in the order they were checked.
export function listingBadges(row: Pick<ListingRow, "lister" | "verifications">): BadgeCheck[] {
  const badges: BadgeCheck[] = [];
  const profile = row.lister.brokerProfile;
  if (profile?.verifiedAt) {
    badges.push({ type: "VERIFIED_BROKER", checkedBy: profile.verifiedBy ?? "", checkedOn: isoDate(profile.verifiedAt) });
  }
  const checkedAt = (v: ListingRow["verifications"][number]) => v.checkedAt ?? v.createdAt;
  const latest = new Map<Badge, ListingRow["verifications"][number]>();
  for (const v of row.verifications) {
    if (v.result !== "PASSED" || v.type === "VERIFIED_BROKER") continue;
    const seen = latest.get(v.type);
    if (!seen || checkedAt(v) > checkedAt(seen)) latest.set(v.type, v);
  }
  const checks = [...latest.values()].sort((a, b) => checkedAt(a).getTime() - checkedAt(b).getTime());
  for (const v of checks) badges.push({ type: v.type, checkedBy: v.reviewer ?? "", checkedOn: isoDate(checkedAt(v)) });
  return badges;
}

// Plot documents uploaded for the listing's document check, whatever the check's result.
export function documentsReceived(row: Pick<ListingRow, "verifications">): Listing["documentsReceived"] {
  const kinds = new Set(
    row.verifications.filter((v) => v.type === "DOCUMENTS_CHECKED").flatMap((v) => v.documents.map((d) => d.kind)),
  );
  const received = PLOT_DOCUMENTS.filter((kind) => kinds.has(kind));
  return received.length > 0 ? received : undefined;
}

export function toListing(row: ListingRow): Listing {
  const locality = row.unit.property.locality;
  return {
    code: row.code,
    category: row.category,
    propertyType: row.unit.type,
    localitySlug: locality.slug,
    localityName: { en: locality.nameEn, te: locality.nameTe },
    title: { en: row.titleEn, te: row.titleTe },
    description: { en: row.descriptionEn ?? "", te: row.descriptionTe ?? "" },
    price: row.price,
    deposit: optional(row.deposit),
    bhk: optional(row.unit.bhk),
    areaSqft: optional(row.unit.areaSqft),
    areaSqyd: optional(row.unit.areaSqyd),
    furnishing: optional(row.furnishing),
    details: toDetails(row.details),
    listerType: row.listerType,
    brokerSlug: row.listerType === "BROKER" ? row.lister.brokerProfile?.slug : undefined,
    ownerPhone: row.lister.phone,
    allowBrokerContact: row.allowBrokerContact,
    // The repository only returns public listings: LIVE, or EXPIRED until re-confirmed.
    status: row.status === "LIVE" ? "LIVE" : "EXPIRED",
    badges: listingBadges(row),
    documentsReceived: documentsReceived(row),
    photos: row.photos,
    availableFrom: row.availableFrom ? isoDate(row.availableFrom) : undefined,
    lastConfirmedAt: isoDate(row.lastConfirmedAt),
  };
}

export function toLocality(row: LocalityRow): Locality {
  return {
    slug: row.slug,
    citySlug: row.city.slug,
    name: { en: row.nameEn, te: row.nameTe },
    avgRentPerMonth: optional(row.avgRentPerMonth),
    avgSalePerSqft: optional(row.avgSalePerSqft),
    avgPlotPerSqyd: optional(row.avgPlotPerSqyd),
  };
}

// Rounded mean minutes from enquiry to first contact, over the leads that have been contacted.
export function averageResponseMinutes(leads: ResponseTimeRow[]): number | undefined {
  const minutes = leads.flatMap((l) => (l.contactedAt ? [(l.contactedAt.getTime() - l.createdAt.getTime()) / 60_000] : []));
  if (minutes.length === 0) return undefined;
  return Math.round(minutes.reduce((sum, m) => sum + m, 0) / minutes.length);
}

export function toBroker(row: BrokerRow, responseTimes: ResponseTimeRow[]): Broker {
  return {
    slug: row.slug,
    displayName: row.displayName,
    agency: optional(row.agencyName),
    yearsExperience: row.yearsExperience ?? 0,
    localitySlugs: row.localities.map((l) => l.slug),
    languages: row.languages,
    reraNumber: optional(row.reraNumber),
    plan: row.plan,
    verified: row.verifiedAt !== null,
    avgResponseMinutes: averageResponseMinutes(responseTimes),
    phone: row.user.phone,
  };
}

export function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    listingCode: row.listing.code,
    name: row.enquirerName ?? row.enquirer?.name ?? "",
    phone: row.enquirerPhone ?? row.enquirer?.phone ?? "",
    source: row.source,
    stage: row.stage,
    createdAt: row.createdAt.toISOString(),
    visitAt: row.visitAt ? row.visitAt.toISOString() : undefined,
  };
}
