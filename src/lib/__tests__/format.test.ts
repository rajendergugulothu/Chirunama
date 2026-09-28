import { describe, expect, it } from "vitest";
import { formatPrice, whatsappLink } from "../format";

describe("formatPrice", () => {
  it("shows rents in full rupees", () => {
    expect(formatPrice(12000, "RENTAL")).toBe("₹12,000");
  });

  it("shows sale prices in lakh and crore", () => {
    expect(formatPrice(8500000, "SALE")).toBe("₹85 L");
    expect(formatPrice(12500000, "SALE")).toBe("₹1.25 Cr");
  });
});

describe("whatsappLink", () => {
  it("encodes the enquiry text", () => {
    expect(whatsappLink("919000000001", "Is TC-1001 available?")).toBe(
      "https://wa.me/919000000001?text=Is%20TC-1001%20available%3F",
    );
  });
});
