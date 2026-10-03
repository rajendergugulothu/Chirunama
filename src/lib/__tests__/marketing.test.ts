import { describe, expect, it } from "vitest";
import { classifiedText, sharePath } from "../marketing";
import { madikonda, plotTC1004 } from "./fixtures";

describe("sharePath", () => {
  it("tags the link with its channel", () => {
    expect(sharePath("/agent/ramesh-realty", "INSTAGRAM")).toBe("/agent/ramesh-realty?src=instagram");
  });
});

describe("classifiedText", () => {
  it("includes locality, price and the listing code", () => {
    const text = classifiedText(plotTC1004, madikonda);
    expect(text).toContain("మడికొండ");
    expect(text).toContain("₹28 L");
    expect(text).toContain("TC-1004");
  });
});
