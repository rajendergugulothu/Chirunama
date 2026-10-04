import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../env";

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalises ADMIN_PHONES and drops invalid entries", () => {
    vi.stubEnv("ADMIN_PHONES", "9000000900, +91 90000 00901,bogus,");
    expect(env().ADMIN_PHONES).toEqual(["919000000900", "919000000901"]);
  });

  it("applies the briefed defaults", () => {
    for (const key of ["STORAGE_DIR", "SUPPORT_WHATSAPP", "WHATSAPP_API_VERSION", "WHATSAPP_OTP_TEMPLATE"]) vi.stubEnv(key, "");
    expect(env()).toMatchObject({
      STORAGE_DIR: ".data/storage",
      SUPPORT_WHATSAPP: "919000000000",
      WHATSAPP_API_VERSION: "v23.0",
      WHATSAPP_OTP_TEMPLATE: "chirunama_otp",
    });
  });

  it("requires AUTH_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => env()).toThrow(/AUTH_SECRET/);
  });

  it("rejects a short AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "too-short");
    expect(() => env()).toThrow(/AUTH_SECRET/);
  });

  it("falls back to a development secret outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(env().AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    warn.mockRestore();
  });

  it("requires DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => env()).toThrow(/DATABASE_URL/);
  });
});
