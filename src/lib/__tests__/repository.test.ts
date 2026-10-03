import { describe, expect, it } from "vitest";
import {
  getListing,
  getLocality,
  isPromotable,
  listingsByBroker,
  localityAverage,
  parseFilters,
  promotedListings,
  searchListings,
} from "../repository";

describe("parseFilters", () => {
  it("normalises query-string values and drops invalid ones", () => {
    expect(parseFilters({ category: "rental", bhk: "2", minPrice: "-5", furnishing: "bogus", ownerOnly: "1" })).toEqual({
      category: "RENTAL",
      locality: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      bhk: 2,
      furnishing: undefined,
      ownerOnly: true,
      verifiedOnly: false,
    });
  });
});

describe("searchListings", () => {
  it("filters owner-only listings", () => {
    const results = searchListings({ ownerOnly: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((l) => l.listerType === "OWNER")).toBe(true);
  });

  it("filters verified-only listings", () => {
    expect(searchListings({ verifiedOnly: true }).every((l) => l.badges.length > 0)).toBe(true);
  });

  it("applies a price range", () => {
    const results = searchListings({ category: "RENTAL", maxPrice: 5000 });
    expect(results.map((l) => l.code)).toEqual(["TC-1002"]);
  });

  it("returns the most recently confirmed listings first", () => {
    const dates = searchListings({}).map((l) => l.lastConfirmedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("listing lifecycle and promotion", () => {
  it("hides expired listings from search", () => {
    expect(searchListings({}).every((l) => l.status === "LIVE")).toBe(true);
    expect(getListing("TC-1007")?.status).toBe("EXPIRED");
    expect(searchListings({}).map((l) => l.code)).not.toContain("TC-1007");
  });

  it("promotes plots only after their documents are checked", () => {
    const plots = searchListings({ category: "PLOT" });
    expect(plots.some((l) => !isPromotable(l))).toBe(true);
    expect(promotedListings({ category: "PLOT" }).every((l) => l.badges.some((b) => b.type === "DOCUMENTS_CHECKED"))).toBe(
      true,
    );
  });

  it("shows expired listings only on the broker's own dashboard", () => {
    expect(listingsByBroker("ramesh-realty").map((l) => l.code)).not.toContain("TC-1007");
    expect(listingsByBroker("ramesh-realty", { includeExpired: true }).map((l) => l.code)).toContain("TC-1007");
  });

  it("compares a listing with the matching locality average", () => {
    const plot = getListing("TC-1004")!;
    expect(localityAverage(plot, getLocality(plot.localitySlug))).toEqual({ amount: 14000, unit: "sqyd" });
    const shop = getListing("TC-1005")!;
    expect(localityAverage(shop, getLocality(shop.localitySlug))).toBeUndefined();
  });
});
