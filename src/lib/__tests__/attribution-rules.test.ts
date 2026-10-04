import { describe, expect, it } from "vitest";
import { LEAD_SOURCE_COOKIE, LEAD_SOURCE_MAX_AGE, parseLeadSource } from "../attribution-rules";

describe("parseLeadSource", () => {
  it.each([
    ["instagram", "INSTAGRAM"],
    ["Instagram", "INSTAGRAM"],
    ["WHATSAPP", "WHATSAPP"],
    ["facebook", "FACEBOOK"],
    ["Newspaper", "NEWSPAPER"],
    ["qr", "QR"],
    ["site", "SITE"],
  ])("maps %j to %s", (raw, expected) => {
    expect(parseLeadSource(raw)).toBe(expected);
  });

  it.each(["bogus", "", "insta", "qr2", null, undefined])("ignores %j", (raw) => {
    expect(parseLeadSource(raw)).toBeUndefined();
  });

  it("names the cookie cn_src and keeps it for 30 days", () => {
    expect(LEAD_SOURCE_COOKIE).toBe("cn_src");
    expect(LEAD_SOURCE_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });
});
