import { describe, expect, it } from "vitest";
import { parseFilters, searchListings } from "../repository";

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
