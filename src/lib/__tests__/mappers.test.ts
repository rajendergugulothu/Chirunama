import { describe, expect, it } from "vitest";
import { averageResponseMinutes, documentsReceived, isoDate, listingBadges, toBroker, toLead, type LeadRow } from "../mappers";

const at = (iso: string) => new Date(iso);

describe("isoDate", () => {
  it("gives the calendar date in India, not UTC", () => {
    expect(isoDate(at("2026-09-09T20:00:00Z"))).toBe("2026-09-10"); // 01:30 IST
    expect(isoDate(at("2026-09-10T04:30:00Z"))).toBe("2026-09-10");
  });
});

describe("averageResponseMinutes", () => {
  it("is the rounded mean over contacted leads only", () => {
    expect(
      averageResponseMinutes([
        { createdAt: at("2026-09-20T10:00:00Z"), contactedAt: at("2026-09-20T10:20:00Z") },
        { createdAt: at("2026-09-21T10:00:00Z"), contactedAt: at("2026-09-21T10:25:00Z") },
        { createdAt: at("2026-09-22T10:00:00Z"), contactedAt: null },
      ]),
    ).toBe(23); // 22.5 rounds up
  });

  it("is undefined when no lead has been contacted", () => {
    expect(averageResponseMinutes([])).toBeUndefined();
    expect(averageResponseMinutes([{ createdAt: at("2026-09-22T10:00:00Z"), contactedAt: null }])).toBeUndefined();
  });
});

describe("listingBadges", () => {
  const verification = (type: "OWNER_VERIFIED" | "DOCUMENTS_CHECKED" | "SITE_VISITED" | "VERIFIED_BROKER", result: "PASSED" | "PENDING" | "FAILED", checkedAt: string | null, reviewer = "Reviewer") => ({
    type,
    result,
    reviewer,
    checkedAt: checkedAt ? at(checkedAt) : null,
    createdAt: at("2026-09-01T00:00:00Z"),
    documents: [],
  });

  it("derives VERIFIED_BROKER from the lister's broker profile", () => {
    const badges = listingBadges({
      lister: { phone: "919000000001", brokerProfile: { slug: "ramesh-realty", verifiedAt: at("2026-09-10T04:30:00Z"), verifiedBy: "Ops lead" } },
      verifications: [verification("VERIFIED_BROKER", "PASSED", "2026-01-01T00:00:00Z", "ignored")],
    });
    expect(badges).toEqual([{ type: "VERIFIED_BROKER", checkedBy: "Ops lead", checkedOn: "2026-09-10" }]);
  });

  it("shows only passed checks, one per type, latest first wins, in check order", () => {
    const badges = listingBadges({
      lister: { phone: "919000000102", brokerProfile: null },
      verifications: [
        verification("SITE_VISITED", "PASSED", "2026-09-23T04:30:00Z", "Field executive"),
        verification("DOCUMENTS_CHECKED", "PENDING", null),
        verification("OWNER_VERIFIED", "PASSED", "2026-09-10T04:30:00Z", "Old"),
        verification("OWNER_VERIFIED", "PASSED", "2026-09-15T04:30:00Z", "Moderation agent"),
        verification("DOCUMENTS_CHECKED", "FAILED", "2026-09-20T04:30:00Z"),
      ],
    });
    expect(badges).toEqual([
      { type: "OWNER_VERIFIED", checkedBy: "Moderation agent", checkedOn: "2026-09-15" },
      { type: "SITE_VISITED", checkedBy: "Field executive", checkedOn: "2026-09-23" },
    ]);
  });

  it("gives no VERIFIED_BROKER badge to an unverified broker", () => {
    expect(
      listingBadges({ lister: { phone: "919000000002", brokerProfile: { slug: "kazipet-homes", verifiedAt: null, verifiedBy: null } }, verifications: [] }),
    ).toEqual([]);
  });
});

describe("documentsReceived", () => {
  it("lists the plot documents uploaded for the document check, in PLOT_DOCUMENTS order", () => {
    const docs = (kinds: string[]) => kinds.map((kind) => ({ kind }));
    const base = { reviewer: null, checkedAt: null, createdAt: at("2026-09-01T00:00:00Z") };
    expect(
      documentsReceived({
        verifications: [
          { ...base, type: "DOCUMENTS_CHECKED", result: "PENDING", documents: docs(["ENCUMBRANCE", "OTHER", "TITLE"]) },
          { ...base, type: "SITE_VISITED", result: "PASSED", documents: docs(["LAYOUT_APPROVAL"]) },
        ],
      }),
    ).toEqual(["TITLE", "ENCUMBRANCE"]);
    expect(documentsReceived({ verifications: [] })).toBeUndefined();
  });
});

describe("toLead", () => {
  const row: LeadRow = {
    id: "l1",
    enquirerName: null,
    enquirerPhone: null,
    enquirer: { name: "Signed-in buyer", phone: "919000000301" },
    source: "QR",
    stage: "NEW",
    createdAt: at("2026-09-28T04:10:00Z"),
    visitAt: null,
    listing: { code: "TC-1003" },
  };

  it("prefers the enquiry's own name and phone, then the enquirer's account", () => {
    expect(toLead(row)).toMatchObject({ name: "Signed-in buyer", phone: "919000000301", listingCode: "TC-1003" });
    expect(toLead({ ...row, enquirerName: "Srinivas K.", enquirerPhone: "919000000201" })).toMatchObject({
      name: "Srinivas K.",
      phone: "919000000201",
    });
    expect(toLead({ ...row, enquirer: null })).toMatchObject({ name: "", phone: "" });
  });
});

describe("toBroker", () => {
  it("is verified when verifiedAt is set and uses the user's phone", () => {
    const broker = toBroker(
      {
        slug: "ramesh-realty",
        displayName: "Ramesh Realty",
        agencyName: null,
        yearsExperience: null,
        languages: ["TE"],
        reraNumber: null,
        plan: "FREE",
        verifiedAt: at("2026-09-10T04:30:00Z"),
        user: { phone: "919000000001" },
        localities: [{ slug: "hanamkonda" }],
      },
      [],
    );
    expect(broker).toMatchObject({ verified: true, phone: "919000000001", avgResponseMinutes: undefined, yearsExperience: 0 });
  });
});
