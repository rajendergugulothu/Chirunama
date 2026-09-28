// Plain view types used by pages. They mirror prisma/schema.prisma so the in-memory
// sample repository can be swapped for Prisma queries without touching the UI.

export type Category = "RENTAL" | "SALE" | "PLOT" | "COMMERCIAL";
export type ListerType = "OWNER" | "BROKER";
export type Furnishing = "UNFURNISHED" | "SEMI" | "FULL";
export type Badge = "OWNER_VERIFIED" | "VERIFIED_BROKER" | "DOCUMENTS_CHECKED" | "SITE_VISITED";
export type BrokerPlan = "FREE" | "PRO" | "AGENCY";

export type Bilingual = { en: string; te: string };

export type City = {
  slug: string;
  name: Bilingual;
  state: string;
  district: string;
};

export type Locality = {
  slug: string;
  citySlug: string;
  name: Bilingual;
  avgRentPerMonth?: number;
  avgSalePerSqft?: number;
  avgPlotPerSqyd?: number;
};

export type BadgeCheck = {
  type: Badge;
  checkedBy: string; // "Moderation agent", "[advocate partner]", "Field executive"
  checkedOn: string; // ISO date
};

export type Listing = {
  code: string; // TC-1042
  category: Category;
  propertyType: string;
  localitySlug: string;
  title: Bilingual;
  description: Bilingual;
  price: number; // monthly rent for rentals, total price otherwise
  deposit?: number;
  bhk?: number;
  areaSqft?: number;
  areaSqyd?: number;
  furnishing?: Furnishing;
  details: Record<string, string | number | boolean>;
  listerType: ListerType;
  brokerSlug?: string;
  ownerPhone: string;
  badges: BadgeCheck[];
  photos: string[];
  availableFrom?: string;
  lastConfirmedAt: string;
};

export type Broker = {
  slug: string;
  displayName: string;
  agency?: string;
  yearsExperience: number;
  localitySlugs: string[];
  languages: ("TE" | "EN")[];
  reraNumber?: string;
  plan: BrokerPlan;
  verified: boolean;
  avgResponseMinutes?: number;
  phone: string;
};

export type LeadSource = "INSTAGRAM" | "WHATSAPP" | "FACEBOOK" | "NEWSPAPER" | "QR" | "SITE";
export type LeadStage = "NEW" | "CONTACTED" | "VISIT_BOOKED" | "CLOSED";

export type Lead = {
  id: string;
  listingCode: string;
  name: string;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  createdAt: string; // ISO date-time
  visitAt?: string;
};

export type ListingStats = {
  code: string;
  views: number;
  saves: number;
};
