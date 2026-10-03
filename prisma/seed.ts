// Development and test data for the Warangal Tricity. Prices and people are illustrative, not
// market data. Run with `npm run db:seed`; it empties every app table first, so it can be run
// again at any time. It refuses to run in production.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { storage } from "../src/lib/storage";

type Tx = Prisma.TransactionClient;

// Times are India Standard Time.
const ist = (date: string, time = "10:00") => new Date(`${date}T${time}:00+05:30`);
const minutesAfter = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const daysBefore = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60_000);

const CITY = {
  slug: "tricity",
  code: "TC",
  nameEn: "Warangal Tricity",
  nameTe: "వరంగల్ ట్రైసిటీ",
  state: "Telangana",
  district: "Hanumakonda",
  active: true,
  lat: 17.9689,
  lng: 79.5941,
};

// Centroids are approximate.
const LOCALITIES = [
  { slug: "hanamkonda", nameEn: "Hanamkonda", nameTe: "హనుమకొండ", lat: 18.0072, lng: 79.5582, avgRentPerMonth: 9500, avgSalePerSqft: 4200 },
  { slug: "kazipet", nameEn: "Kazipet", nameTe: "కాజీపేట", lat: 17.9784, lng: 79.5003, avgRentPerMonth: 8000, avgSalePerSqft: 3600 },
  { slug: "subedari", nameEn: "Subedari", nameTe: "సుబేదారి", lat: 18.013, lng: 79.565, avgRentPerMonth: 11000, avgSalePerSqft: 4800 },
  { slug: "hunter-road", nameEn: "Hunter Road", nameTe: "హంటర్ రోడ్", lat: 17.993, lng: 79.577, avgRentPerMonth: 10000, avgSalePerSqft: 4500 },
  { slug: "madikonda", nameEn: "Madikonda", nameTe: "మడికొండ", lat: 17.956, lng: 79.505, avgRentPerMonth: 8500, avgPlotPerSqyd: 14000 },
] as const;

type Role = "OWNER" | "BUYER" | "BROKER" | "ADMIN" | "ADVOCATE" | "FIELD_EXECUTIVE";

const USERS: { key: string; phone: string; name: string; roles: Role[]; language: "TE" | "EN" }[] = [
  { key: "ramesh", phone: "919000000001", name: "Ramesh Goud", roles: ["BROKER"], language: "TE" },
  { key: "kazipetHomes", phone: "919000000002", name: "Mahesh Yadav", roles: ["BROKER"], language: "TE" },
  { key: "ownerVenkat", phone: "919000000101", name: "Venkata Rao", roles: ["OWNER"], language: "TE" },
  { key: "ownerPadma", phone: "919000000102", name: "Padma Reddy", roles: ["OWNER"], language: "TE" },
  { key: "admin", phone: "919000000900", name: "Kavitha (Ops lead)", roles: ["ADMIN"], language: "EN" },
  { key: "advocate", phone: "919000000901", name: "Adv. Srinivas Murthy", roles: ["ADVOCATE"], language: "EN" },
  { key: "fieldExec", phone: "919000000902", name: "Naresh (Field executive)", roles: ["FIELD_EXECUTIVE"], language: "TE" },
  { key: "buyerSwathi", phone: "919000000301", name: "Swathi", roles: ["BUYER"], language: "EN" },
  { key: "buyerRahul", phone: "919000000302", name: "Rahul", roles: ["BUYER"], language: "TE" },
];

const BROKERS = [
  {
    user: "ramesh",
    slug: "ramesh-realty",
    displayName: "Ramesh Realty",
    agencyName: "Ramesh Realty",
    yearsExperience: 12,
    languages: ["TE", "EN"] as ("TE" | "EN")[],
    plan: "PRO" as const,
    officeAddress: "Near Kakaji Colony, Hanamkonda",
    verified: { at: ist("2026-09-10"), by: "Ops lead" },
    localities: ["hanamkonda", "subedari", "hunter-road"],
  },
  {
    user: "kazipetHomes",
    slug: "kazipet-homes",
    displayName: "Kazipet Homes",
    agencyName: null,
    yearsExperience: 5,
    languages: ["TE"] as ("TE" | "EN")[],
    plan: "FREE" as const,
    officeAddress: "Kazipet Junction Road, Kazipet",
    verified: null,
    localities: ["kazipet", "madikonda"],
  },
];

type Check = {
  type: "OWNER_VERIFIED" | "DOCUMENTS_CHECKED" | "SITE_VISITED";
  reviewer: string | null;
  reviewerKey: "advocate" | "fieldExec" | null;
  result: "PASSED" | "PENDING";
  on: string | null;
  notes?: string;
  documents?: ("TITLE" | "ENCUMBRANCE" | "LAYOUT_APPROVAL")[];
};

type SeedListing = {
  number: number;
  category: "RENTAL" | "SALE" | "PLOT" | "COMMERCIAL";
  type: "FLAT" | "ROOM" | "HOUSE" | "PLOT" | "SHOP";
  locality: string;
  lister: string;
  listerType: "OWNER" | "BROKER";
  status: "LIVE" | "EXPIRED";
  titleEn: string;
  titleTe: string;
  descriptionEn: string;
  descriptionTe: string;
  price: number;
  deposit?: number;
  bhk?: number;
  areaSqft?: number;
  areaSqyd?: number;
  facing?: string;
  furnishing?: "UNFURNISHED" | "SEMI" | "FULL";
  details: Record<string, string | number | boolean>;
  allowBrokerContact: boolean;
  availableFrom?: string;
  lastConfirmed: string;
  views?: number;
  checks: Check[];
};

const LISTINGS: SeedListing[] = [
  {
    number: 1001,
    category: "RENTAL",
    type: "FLAT",
    locality: "hanamkonda",
    lister: "ownerVenkat",
    listerType: "OWNER",
    status: "LIVE",
    titleEn: "2 BHK flat near Hanamkonda bus stand",
    titleTe: "హనుమకొండ బస్ స్టాండ్ దగ్గర 2 BHK ఫ్లాట్",
    descriptionEn: "Second floor, lift, covered parking. Family preferred.",
    descriptionTe: "రెండో అంతస్తు, లిఫ్ట్, కవర్డ్ పార్కింగ్. కుటుంబాలకు ప్రాధాన్యం.",
    price: 12000,
    deposit: 24000,
    bhk: 2,
    areaSqft: 1050,
    furnishing: "SEMI",
    details: { tenantPreference: "Family" },
    allowBrokerContact: false,
    availableFrom: "2026-10-01",
    lastConfirmed: "2026-09-25",
    checks: [{ type: "OWNER_VERIFIED", reviewer: "Moderation agent", reviewerKey: null, result: "PASSED", on: "2026-09-20" }],
  },
  {
    number: 1002,
    category: "RENTAL",
    type: "ROOM",
    locality: "kazipet",
    lister: "kazipetHomes",
    listerType: "BROKER",
    status: "LIVE",
    titleEn: "Single room for students near NIT Warangal",
    titleTe: "NIT వరంగల్ దగ్గర విద్యార్థులకు సింగిల్ రూమ్",
    descriptionEn: "Attached bath, Wi-Fi, semester terms.",
    descriptionTe: "అటాచ్డ్ బాత్, Wi-Fi, సెమిస్టర్ ఒప్పందం.",
    price: 4500,
    deposit: 4500,
    furnishing: "FULL",
    details: { tenantPreference: "Students" },
    allowBrokerContact: true,
    lastConfirmed: "2026-09-24",
    checks: [],
  },
  {
    number: 1003,
    category: "SALE",
    type: "HOUSE",
    locality: "subedari",
    lister: "ramesh",
    listerType: "BROKER",
    status: "LIVE",
    titleEn: "Independent house, 3 BHK, east facing",
    titleTe: "స్వతంత్ర ఇల్లు, 3 BHK, తూర్పు ముఖం",
    descriptionEn: "G+1, 8 years old, 30 ft road.",
    descriptionTe: "G+1, 8 ఏళ్ల పాతది, 30 అడుగుల రోడ్డు.",
    price: 8500000,
    bhk: 3,
    areaSqft: 1800,
    facing: "East",
    details: { facing: "East", ageYears: 8, parking: true },
    allowBrokerContact: true,
    lastConfirmed: "2026-09-26",
    views: 412,
    checks: [{ type: "DOCUMENTS_CHECKED", reviewer: "[advocate partner]", reviewerKey: "advocate", result: "PASSED", on: "2026-09-18" }],
  },
  {
    number: 1004,
    category: "PLOT",
    type: "PLOT",
    locality: "madikonda",
    lister: "ownerPadma",
    listerType: "OWNER",
    status: "LIVE",
    titleEn: "200 sq. yd plot in approved layout",
    titleTe: "అనుమతి పొందిన లేఅవుట్‌లో 200 చ. గజాల ప్లాట్",
    descriptionEn: "Near IT park, 33 ft road, clear title.",
    descriptionTe: "IT పార్క్ దగ్గర, 33 అడుగుల రోడ్డు.",
    price: 2800000,
    areaSqyd: 200,
    details: { surveyNumber: "123/A", layoutName: "Sri Sai Enclave", roadWidthFt: 33, approvalStatus: "Approved" },
    allowBrokerContact: true,
    lastConfirmed: "2026-09-23",
    checks: [
      { type: "OWNER_VERIFIED", reviewer: "Moderation agent", reviewerKey: null, result: "PASSED", on: "2026-09-15" },
      {
        type: "DOCUMENTS_CHECKED",
        reviewer: "[advocate partner]",
        reviewerKey: "advocate",
        result: "PASSED",
        on: "2026-09-22",
        documents: ["TITLE", "ENCUMBRANCE", "LAYOUT_APPROVAL"],
      },
      { type: "SITE_VISITED", reviewer: "Field executive", reviewerKey: "fieldExec", result: "PASSED", on: "2026-09-23" },
    ],
  },
  {
    number: 1005,
    category: "COMMERCIAL",
    type: "SHOP",
    locality: "hunter-road",
    lister: "ramesh",
    listerType: "BROKER",
    status: "LIVE",
    titleEn: "Ground-floor shop on Hunter Road",
    titleTe: "హంటర్ రోడ్‌లో గ్రౌండ్ ఫ్లోర్ షాప్",
    descriptionEn: "18 ft frontage, suits retail or clinic.",
    descriptionTe: "18 అడుగుల ముందుభాగం, రిటైల్ లేదా క్లినిక్‌కు అనుకూలం.",
    price: 25000,
    deposit: 100000,
    areaSqft: 400,
    details: { frontageFt: 18, usageType: "Retail" },
    allowBrokerContact: true,
    lastConfirmed: "2026-09-27",
    views: 198,
    checks: [],
  },
  {
    number: 1006,
    category: "PLOT",
    type: "PLOT",
    locality: "kazipet",
    lister: "kazipetHomes",
    listerType: "BROKER",
    status: "LIVE",
    titleEn: "150 sq. yd plot near Kazipet junction",
    titleTe: "కాజీపేట జంక్షన్ దగ్గర 150 చ. గజాల ప్లాట్",
    descriptionEn: "East facing, 30 ft road. Layout approval papers awaited.",
    descriptionTe: "తూర్పు ముఖం, 30 అడుగుల రోడ్డు. లేఅవుట్ అనుమతి పత్రాలు రావాల్సి ఉంది.",
    price: 1650000,
    areaSqyd: 150,
    facing: "East",
    details: { surveyNumber: "88/2", layoutName: "Railway Colony Extension", roadWidthFt: 30, approvalStatus: "Pending" },
    allowBrokerContact: true,
    lastConfirmed: "2026-09-29",
    checks: [
      {
        type: "DOCUMENTS_CHECKED",
        reviewer: null,
        reviewerKey: null,
        result: "PENDING",
        on: null,
        notes: "Layout approval papers awaited.",
        documents: ["TITLE", "ENCUMBRANCE"],
      },
    ],
  },
  {
    number: 1007,
    category: "RENTAL",
    type: "HOUSE",
    locality: "hanamkonda",
    lister: "ramesh",
    listerType: "BROKER",
    status: "EXPIRED",
    titleEn: "1 BHK portion near Kakatiya University",
    titleTe: "కాకతీయ యూనివర్సిటీ దగ్గర 1 BHK పోర్షన్",
    descriptionEn: "Ground floor, separate entrance.",
    descriptionTe: "గ్రౌండ్ ఫ్లోర్, వేరే ప్రవేశం.",
    price: 7000,
    deposit: 14000,
    bhk: 1,
    furnishing: "UNFURNISHED",
    details: { tenantPreference: "Any" },
    allowBrokerContact: true,
    lastConfirmed: "2026-08-20",
    checks: [],
  },
];

const LEADS = [
  { code: "TC-1003", name: "Srinivas K.", phone: "919000000201", source: "INSTAGRAM", stage: "NEW", kind: "WHATSAPP", at: ist("2026-09-28", "09:40") },
  { code: "TC-1005", name: "Dr. Anitha R.", phone: "919000000202", source: "NEWSPAPER", stage: "NEW", kind: "CALL", at: ist("2026-09-28", "08:15") },
  { code: "TC-1003", name: "Praveen M.", phone: "919000000203", source: "WHATSAPP", stage: "CONTACTED", kind: "WHATSAPP", at: ist("2026-09-27", "18:05") },
  {
    code: "TC-1005",
    name: "Lakshmi Traders",
    phone: "919000000204",
    source: "SITE",
    stage: "VISIT_BOOKED",
    kind: "VISIT",
    at: ist("2026-09-26", "11:20"),
    visitAt: ist("2026-09-29", "17:00"),
  },
  {
    code: "TC-1003",
    name: "Ravi Teja P.",
    phone: "919000000205",
    source: "QR",
    stage: "VISIT_BOOKED",
    kind: "VISIT",
    at: ist("2026-09-25", "16:45"),
    visitAt: ist("2026-09-30", "10:30"),
  },
  { code: "TC-1005", name: "Sai Mobiles", phone: "919000000206", source: "FACEBOOK", stage: "CLOSED", kind: "WHATSAPP", at: ist("2026-09-20", "12:00") },
] as const;

// Every lead past NEW was answered 20 minutes after it came in.
const RESPONSE_MINUTES = 20;

const FAVORITES = [
  { user: "buyerSwathi", code: "TC-1003" },
  { user: "buyerRahul", code: "TC-1003" },
  { user: "buyerSwathi", code: "TC-1005" },
];

const DOCUMENT_SLUG = { TITLE: "title", ENCUMBRANCE: "encumbrance", LAYOUT_APPROVAL: "layout-approval" } as const;

// A one-page PDF that says it is a placeholder, so nobody mistakes it for a real document.
export function placeholderPdf(text: string): Uint8Array {
  const safe = text.replace(/[^\x20-\x7e]/g, "?").replace(/([()\\])/g, "\\$1");
  const content = `BT /F1 14 Tf 72 720 Td (${safe}) Tj 0 -24 Td (Placeholder for development. Not a real document.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

async function truncateAll(tx: Tx) {
  const tables = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename NOT IN ('_prisma_migrations', 'spatial_ref_sys')`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename.replace(/"/g, '""')}"`).join(", ");
  await tx.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function insertAll(tx: Tx, files: Map<string, { key: string; size: number }>) {
  const city = await tx.city.create({ data: CITY });

  const localities = new Map<string, string>();
  for (const l of LOCALITIES) {
    const row = await tx.locality.create({ data: { ...l, cityId: city.id, avgUpdatedAt: ist("2026-09-30") } });
    localities.set(l.slug, row.id);
  }
  const localityId = (slug: string) => localities.get(slug)!;

  const users = new Map<string, string>();
  for (const u of USERS) {
    const row = await tx.user.create({
      data: { phone: u.phone, name: u.name, roles: u.roles, language: u.language, createdAt: ist("2026-08-01") },
    });
    users.set(u.key, row.id);
  }
  const userId = (key: string) => users.get(key)!;

  for (const b of BROKERS) {
    await tx.brokerProfile.create({
      data: {
        userId: userId(b.user),
        slug: b.slug,
        displayName: b.displayName,
        agencyName: b.agencyName,
        yearsExperience: b.yearsExperience,
        languages: b.languages,
        plan: b.plan,
        officeAddress: b.officeAddress,
        verifiedAt: b.verified?.at ?? null,
        verifiedBy: b.verified?.by ?? null,
        verifiedById: b.verified ? userId("admin") : null,
        localities: { connect: b.localities.map((slug) => ({ id: localityId(slug) })) },
        createdAt: ist("2026-08-01"),
      },
    });
  }

  const listingIds = new Map<string, string>();
  for (const [i, l] of LISTINGS.entries()) {
    const code = `${CITY.code}-${l.number}`;
    const centroid = LOCALITIES.find((x) => x.slug === l.locality)!;
    const lastConfirmedAt = ist(l.lastConfirmed);
    const createdAt = daysBefore(lastConfirmedAt, 7);
    const property = await tx.property.create({
      data: {
        cityId: city.id,
        localityId: localityId(l.locality),
        ownerId: l.listerType === "OWNER" ? userId(l.lister) : null,
        lat: Number((centroid.lat + 0.002 * (i - 3)).toFixed(4)),
        lng: Number((centroid.lng - 0.0015 * (i - 3)).toFixed(4)),
        createdAt,
        units: {
          create: { type: l.type, bhk: l.bhk, areaSqft: l.areaSqft, areaSqyd: l.areaSqyd, facing: l.facing },
        },
      },
      include: { units: { select: { id: true } } },
    });
    const listing = await tx.listing.create({
      data: {
        number: l.number,
        code,
        unitId: property.units[0].id,
        category: l.category,
        listerId: userId(l.lister),
        listerType: l.listerType,
        status: l.status,
        titleEn: l.titleEn,
        titleTe: l.titleTe,
        descriptionEn: l.descriptionEn,
        descriptionTe: l.descriptionTe,
        price: l.price,
        deposit: l.deposit,
        furnishing: l.furnishing,
        details: l.details,
        photos: [],
        allowBrokerContact: l.allowBrokerContact,
        availableFrom: l.availableFrom ? ist(l.availableFrom) : null,
        views: l.views ?? 0,
        lastConfirmedAt,
        intakeSource: "form",
        createdAt,
      },
    });
    listingIds.set(code, listing.id);

    for (const check of l.checks) {
      const documents = check.documents ?? [];
      await tx.verification.create({
        data: {
          type: check.type,
          listingId: listing.id,
          propertyId: property.id,
          reviewer: check.reviewer,
          reviewerId: check.reviewerKey ? userId(check.reviewerKey) : null,
          result: check.result,
          checkedAt: check.on ? ist(check.on) : null,
          notes: check.notes,
          checklist:
            check.type === "DOCUMENTS_CHECKED"
              ? (["TITLE", "ENCUMBRANCE", "LAYOUT_APPROVAL"] as const).map((item) => ({
                  item,
                  status: documents.includes(item) ? "RECEIVED" : "MISSING",
                }))
              : [],
          createdAt: check.on ? daysBefore(ist(check.on), 1) : ist(l.lastConfirmed),
          documents: {
            create: documents.map((kind) => {
              const file = files.get(`${code}:${kind}`)!;
              return {
                kind,
                storageKey: file.key,
                fileName: file.key.slice(file.key.lastIndexOf("/") + 1),
                mimeType: "application/pdf",
                size: file.size,
                uploadedById: userId(l.lister),
              };
            }),
          },
        },
      });
    }
  }

  // Explicit listing numbers leave the sequence behind; move it past them.
  await tx.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Listing"', 'number'), (SELECT max(number) FROM "Listing"))`,
  );

  for (const lead of LEADS) {
    const answered = lead.stage !== "NEW";
    await tx.lead.create({
      data: {
        listingId: listingIds.get(lead.code)!,
        enquirerName: lead.name,
        enquirerPhone: lead.phone,
        kind: lead.kind,
        source: lead.source,
        stage: lead.stage,
        visitAt: "visitAt" in lead ? lead.visitAt : null,
        contactedAt: answered ? minutesAfter(lead.at, RESPONSE_MINUTES) : null,
        createdAt: lead.at,
      },
    });
  }

  for (const f of FAVORITES) {
    await tx.favorite.create({ data: { userId: userId(f.user), listingId: listingIds.get(f.code)!, createdAt: ist("2026-09-28") } });
  }
}

export async function seed(db: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed: NODE_ENV is production.");

  // Placeholder files first: writing them again is harmless.
  const files = new Map<string, { key: string; size: number }>();
  for (const l of LISTINGS) {
    const code = `${CITY.code}-${l.number}`;
    for (const check of l.checks) {
      for (const kind of check.documents ?? []) {
        const key = `documents/seed/${code.toLowerCase()}-${DOCUMENT_SLUG[kind]}.pdf`;
        const pdf = placeholderPdf(`${code} ${kind.toLowerCase().replace("_", " ")}`);
        await storage().put(key, pdf);
        files.set(`${code}:${kind}`, { key, size: pdf.byteLength });
      }
    }
  }

  await db.$transaction(
    async (tx) => {
      await truncateAll(tx);
      await insertAll(tx, files);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV is production.");
    process.exit(1);
  }
  const { config } = await import("dotenv");
  config({ quiet: true });
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await seed(db);
    const [listings, users] = await Promise.all([db.listing.count(), db.user.count()]);
    console.log(`Seeded ${listings} listings and ${users} users.`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
