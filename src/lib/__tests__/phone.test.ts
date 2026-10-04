import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "../phone";

describe("normalizePhone", () => {
  it.each(["9000000001", "+91 90000 00001", "09000000001", "919000000001", "+91-90000-00001", " 9000000001 "])(
    "normalises %j to 91XXXXXXXXXX",
    (input) => {
      expect(normalizePhone(input)).toBe("919000000001");
    },
  );

  it.each(["5000000001", "12345", "abc", "", "+1 9000000001", "90000000011", "900000000", "+9190000000012", "9000000001x"])(
    "rejects %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );

  it("rejects non-strings and absurdly long input", () => {
    expect(normalizePhone(undefined as unknown as string)).toBeNull();
    expect(normalizePhone("9".repeat(40))).toBeNull();
  });
});

describe("maskPhone", () => {
  it("shows only the last four digits", () => {
    expect(maskPhone("919000000001")).toBe("+91 ******0001");
  });

  it("masks a bare 10-digit number the same way", () => {
    expect(maskPhone("9000000901")).toBe("+91 ******0901");
  });
});
