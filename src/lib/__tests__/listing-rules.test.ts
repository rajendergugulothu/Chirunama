import { describe, expect, it } from "vitest";
import { isPromotable, localityAverage, parseFilters } from "../listing-rules";
import { hunterRoad, madikonda, plotTC1004, shopTC1005 } from "./fixtures";

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

describe("isPromotable", () => {
  it("promotes plots only after their documents are checked", () => {
    expect(isPromotable(plotTC1004)).toBe(true);
    const unchecked = { ...plotTC1004, badges: plotTC1004.badges.filter((b) => b.type !== "DOCUMENTS_CHECKED") };
    expect(isPromotable(unchecked)).toBe(false);
  });

  it("never promotes expired listings", () => {
    expect(isPromotable({ ...shopTC1005, status: "EXPIRED" })).toBe(false);
  });
});

describe("localityAverage", () => {
  it("compares a listing with the matching locality average", () => {
    expect(localityAverage(plotTC1004, madikonda)).toEqual({ amount: 14000, unit: "sqyd" });
    expect(localityAverage(shopTC1005, hunterRoad)).toBeUndefined();
  });
});
