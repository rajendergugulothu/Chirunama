import { describe, expect, it } from "vitest";
import { classifiedText, sharePath } from "../marketing";
import { getListing, getLocality, leadsForBroker } from "../repository";

describe("sharePath", () => {
  it("tags the link with its channel", () => {
    expect(sharePath("/agent/ramesh-realty", "INSTAGRAM")).toBe("/agent/ramesh-realty?src=instagram");
  });
});

describe("classifiedText", () => {
  it("includes locality, price and the listing code", () => {
    const listing = getListing("TC-1004")!;
    const text = classifiedText(listing, getLocality(listing.localitySlug));
    expect(text).toContain("మడికొండ");
    expect(text).toContain("₹28 L");
    expect(text).toContain("TC-1004");
  });
});

describe("leadsForBroker", () => {
  it("returns only leads on that broker's listings, newest first", () => {
    const leads = leadsForBroker("ramesh-realty");
    expect(leads.length).toBeGreaterThan(0);
    expect(leads.every((l) => ["TC-1003", "TC-1005"].includes(l.listingCode))).toBe(true);
    expect(leads.map((l) => l.createdAt)).toEqual(leads.map((l) => l.createdAt).sort().reverse());
  });
});
