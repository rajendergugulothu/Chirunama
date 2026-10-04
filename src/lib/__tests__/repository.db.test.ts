import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  allLocalities,
  getBroker,
  getBrokerForUser,
  getListing,
  getLocality,
  hasBrokerProfile,
  leadsForBroker,
  listingsByBroker,
  listingStats,
  promotedListings,
  searchListings,
  supportContact,
} from "../repository";

// Runs against the seeded test database (npm run test:db). Every expectation below comes from
// prisma/seed.ts, whose dates are fixed, so nothing depends on today's date.

const codes = (listings: { code: string }[]) => listings.map((l) => l.code);

async function userId(phone: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
}

describe("searchListings", () => {
  it("returns only LIVE listings, most recently confirmed first, without TC-1007", async () => {
    const results = await searchListings({});
    expect(codes(results)).toEqual(["TC-1006", "TC-1005", "TC-1003", "TC-1001", "TC-1002", "TC-1004"]);
    expect(results.every((l) => l.status === "LIVE")).toBe(true);
    const dates = results.map((l) => l.lastConfirmedAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(codes(results)).not.toContain("TC-1007");
  });

  it("applies a category and price range", async () => {
    expect(codes(await searchListings({ category: "RENTAL", maxPrice: 5000 }))).toEqual(["TC-1002"]);
    expect(codes(await searchListings({ category: "SALE", minPrice: 9_000_000 }))).toEqual([]);
    expect(codes(await searchListings({ minPrice: 2_000_000, maxPrice: 3_000_000 }))).toEqual(["TC-1004"]);
  });

  it("filters owner-only listings", async () => {
    const results = await searchListings({ ownerOnly: true });
    expect(codes(results).sort()).toEqual(["TC-1001", "TC-1004"]);
    expect(results.every((l) => l.listerType === "OWNER")).toBe(true);
  });

  it("filters verified-only listings: a passed check, or a verified broker", async () => {
    const results = await searchListings({ verifiedOnly: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((l) => l.badges.length > 0)).toBe(true);
    // TC-1002 (unverified broker, no checks) and TC-1006 (only a pending check) are left out.
    expect(codes(results).sort()).toEqual(["TC-1001", "TC-1003", "TC-1004", "TC-1005"]);
  });

  it("matches bhk on the unit, and filters by locality and furnishing", async () => {
    expect(codes(await searchListings({ bhk: 3 }))).toEqual(["TC-1003"]);
    expect(codes(await searchListings({ bhk: 1 }))).toEqual([]); // TC-1007 is expired
    expect(codes(await searchListings({ locality: "kazipet" }))).toEqual(["TC-1006", "TC-1002"]);
    expect(codes(await searchListings({ furnishing: "SEMI" }))).toEqual(["TC-1001"]);
    expect(codes(await searchListings({ locality: "no-such-place" }))).toEqual([]);
  });
});

describe("promotedListings", () => {
  it("promotes plots only after their documents are checked", async () => {
    const promoted = codes(await promotedListings({ category: "PLOT" }));
    expect(promoted).toContain("TC-1004");
    expect(promoted).not.toContain("TC-1006");
  });

  it("promotes live listings of other categories as they are", async () => {
    const promoted = codes(await promotedListings());
    expect(promoted).toEqual(["TC-1005", "TC-1003", "TC-1001", "TC-1002", "TC-1004"]);
  });
});

describe("listingsByBroker", () => {
  it("leaves expired listings out unless asked", async () => {
    expect(codes(await listingsByBroker("ramesh-realty"))).toEqual(["TC-1005", "TC-1003"]);
    expect(codes(await listingsByBroker("ramesh-realty", { includeExpired: true }))).toEqual(["TC-1005", "TC-1003", "TC-1007"]);
    expect(codes(await listingsByBroker("kazipet-homes", { includeExpired: true }))).toEqual(["TC-1006", "TC-1002"]);
    expect(await listingsByBroker("nobody")).toEqual([]);
  });
});

describe("getListing", () => {
  it("matches codes case-insensitively and shows plot documents and the document check", async () => {
    const listing = await getListing("tc-1004");
    expect(listing?.code).toBe("TC-1004");
    expect(listing?.documentsReceived).toEqual(["TITLE", "ENCUMBRANCE", "LAYOUT_APPROVAL"]);
    expect(listing?.badges).toContainEqual({ type: "DOCUMENTS_CHECKED", checkedBy: "[advocate partner]", checkedOn: "2026-09-22" });
    expect(listing?.localityName).toEqual({ en: "Madikonda", te: "మడికొండ" });
  });

  it("lists documents received for a pending check", async () => {
    const listing = await getListing("TC-1006");
    expect(listing?.documentsReceived).toEqual(["TITLE", "ENCUMBRANCE"]);
    expect(listing?.badges.map((b) => b.type)).not.toContain("DOCUMENTS_CHECKED");
  });

  it("returns EXPIRED listings but not unknown codes", async () => {
    expect((await getListing("TC-1007"))?.status).toBe("EXPIRED");
    expect(await getListing("TC-9999")).toBeUndefined();
    expect(await getListing("")).toBeUndefined();
  });

  it.each(["CLOSED", "SUSPENDED", "DRAFT", "PENDING_OTP"] as const)("hides a %s listing", async (status) => {
    await prisma.listing.update({ where: { code: "TC-1002" }, data: { status } });
    try {
      expect(await getListing("TC-1002")).toBeUndefined();
      expect(codes(await searchListings({}))).not.toContain("TC-1002");
    } finally {
      await prisma.listing.update({ where: { code: "TC-1002" }, data: { status: "LIVE" } });
    }
  });
});

describe("brokers", () => {
  it("derives the VERIFIED_BROKER badge from the broker profile", async () => {
    const listing = await getListing("TC-1003");
    expect(listing?.badges).toContainEqual({ type: "VERIFIED_BROKER", checkedBy: "Ops lead", checkedOn: "2026-09-10" });
    expect(listing?.brokerSlug).toBe("ramesh-realty");
    expect((await getListing("TC-1002"))?.badges.map((b) => b.type)).not.toContain("VERIFIED_BROKER");
  });

  it("gives a verified broker with answered leads a response time", async () => {
    const broker = await getBroker("ramesh-realty");
    expect(broker).toMatchObject({ slug: "ramesh-realty", displayName: "Ramesh Realty", verified: true, avgResponseMinutes: 20, phone: "919000000001" });
    expect(broker?.localitySlugs).toEqual(["hanamkonda", "hunter-road", "subedari"]);
  });

  it("gives an unverified broker with no leads no response time", async () => {
    const broker = await getBroker("kazipet-homes");
    expect(broker?.verified).toBe(false);
    expect(broker?.avgResponseMinutes).toBeUndefined();
    expect(await getBroker("nobody")).toBeUndefined();
  });

  it("finds a broker by user, and only for users with a profile", async () => {
    expect((await getBrokerForUser(await userId("919000000001")))?.slug).toBe("ramesh-realty");
    expect((await getBrokerForUser(await userId("919000000002")))?.slug).toBe("kazipet-homes");
    expect(await getBrokerForUser(await userId("919000000301"))).toBeNull();
    expect(await hasBrokerProfile(await userId("919000000001"))).toBe(true);
    expect(await hasBrokerProfile(await userId("919000000900"))).toBe(false);
  });
});

describe("listingStats", () => {
  it("counts views and saves (favourites)", async () => {
    const stats = await listingStats(["TC-1003", "TC-1005"]);
    expect(stats.get("TC-1003")).toEqual({ views: 412, saves: 2 });
    expect(stats.get("TC-1005")).toEqual({ views: 198, saves: 1 });
  });

  it("gives zeros for unknown codes and listings without activity", async () => {
    const stats = await listingStats(["TC-1001", "TC-9999"]);
    expect(stats.get("TC-1001")).toEqual({ views: 0, saves: 0 });
    expect(stats.get("TC-9999")).toEqual({ views: 0, saves: 0 });
  });
});

describe("leadsForBroker", () => {
  it("returns all six of Ramesh's leads, newest first, with enquirer names and phones", async () => {
    const leads = await leadsForBroker("ramesh-realty");
    expect(leads).toHaveLength(6);
    expect(leads.every((l) => ["TC-1003", "TC-1005"].includes(l.listingCode))).toBe(true);
    const times = leads.map((l) => l.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(leads[0]).toMatchObject({ name: "Srinivas K.", phone: "919000000201", listingCode: "TC-1003", source: "INSTAGRAM", stage: "NEW" });
  });

  it("returns no leads for a broker whose listings have none", async () => {
    expect(await leadsForBroker("kazipet-homes")).toEqual([]);
  });
});

describe("localities and support", () => {
  it("lists localities by English name, with averages", async () => {
    const localities = await allLocalities();
    expect(localities.map((l) => l.slug)).toEqual(["hanamkonda", "hunter-road", "kazipet", "madikonda", "subedari"]);
    expect(await getLocality("madikonda")).toMatchObject({ citySlug: "tricity", avgPlotPerSqyd: 14000, avgRentPerMonth: 8500 });
    expect(await getLocality("nowhere")).toBeUndefined();
  });

  it("gives the support WhatsApp number", async () => {
    expect(await supportContact()).toMatch(/^\d{10,15}$/);
  });
});
