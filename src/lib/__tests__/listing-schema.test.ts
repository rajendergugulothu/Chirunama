import { describe, expect, it } from "vitest";
import { listingInput } from "../listing-schema";

const base = {
  localitySlug: "madikonda",
  titleEn: "200 sq. yd plot",
  titleTe: "ప్లాట్",
  price: 2800000,
  listerType: "OWNER",
};

describe("listingInput", () => {
  it("accepts a plot with its required fields", () => {
    const result = listingInput.safeParse({
      ...base,
      category: "PLOT",
      details: { areaSqyd: 200, surveyNumber: "123/A", layoutName: "Sri Sai Enclave", roadWidthFt: 33, approvalStatus: "Approved" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a plot without a survey number", () => {
    const result = listingInput.safeParse({
      ...base,
      category: "PLOT",
      details: { areaSqyd: 200, layoutName: "Sri Sai Enclave", roadWidthFt: 33, approvalStatus: "Approved" },
    });
    expect(result.success).toBe(false);
  });
});
