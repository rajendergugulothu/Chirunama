import { describe, expect, it } from "vitest";
import { getListing, leadsForBroker, listingsByBroker, promotedListings, searchListings } from "../repository";

// Runs against the seeded test database (npm run test:db).

describe("searchListings", () => {
  it("filters owner-only listings", async () => {
    const results = await searchListings({ ownerOnly: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((l) => l.listerType === "OWNER")).toBe(true);
  });

  it("filters verified-only listings", async () => {
    expect((await searchListings({ verifiedOnly: true })).every((l) => l.badges.length > 0)).toBe(true);
  });

  it("applies a price range", async () => {
    const results = await searchListings({ category: "RENTAL", maxPrice: 5000 });
    expect(results.map((l) => l.code)).toEqual(["TC-1002"]);
  });

  it("returns the most recently confirmed listings first", async () => {
    const dates = (await searchListings({})).map((l) => l.lastConfirmedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("listing lifecycle and promotion", () => {
  it("hides expired listings from search", async () => {
    const results = await searchListings({});
    expect(results.every((l) => l.status === "LIVE")).toBe(true);
    expect((await getListing("TC-1007"))?.status).toBe("EXPIRED");
    expect(results.map((l) => l.code)).not.toContain("TC-1007");
  });

  it("promotes plots only after their documents are checked", async () => {
    const plots = await searchListings({ category: "PLOT" });
    const promoted = await promotedListings({ category: "PLOT" });
    expect(promoted.length).toBeLessThan(plots.length);
    expect(promoted.every((l) => l.badges.some((b) => b.type === "DOCUMENTS_CHECKED"))).toBe(true);
  });

  it("shows expired listings only on the broker's own dashboard", async () => {
    expect((await listingsByBroker("ramesh-realty")).map((l) => l.code)).not.toContain("TC-1007");
    expect((await listingsByBroker("ramesh-realty", { includeExpired: true })).map((l) => l.code)).toContain("TC-1007");
  });
});

describe("leadsForBroker", () => {
  it("returns only leads on that broker's listings, newest first", async () => {
    const leads = await leadsForBroker("ramesh-realty");
    expect(leads.length).toBeGreaterThan(0);
    expect(leads.every((l) => ["TC-1003", "TC-1005"].includes(l.listingCode))).toBe(true);
    expect(leads.map((l) => l.createdAt)).toEqual(leads.map((l) => l.createdAt).sort().reverse());
  });
});
