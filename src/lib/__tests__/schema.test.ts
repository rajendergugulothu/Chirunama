import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static checks on the Prisma schema and the first migration. The database side (tables
// created, no drift) is in seed.db.test.ts.

const ROOT = path.resolve(__dirname, "../../..");
const schema = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
const migrationsDir = path.join(ROOT, "prisma/migrations");
const migrations = readdirSync(migrationsDir).filter((name) => !name.endsWith(".toml"));
const migrationSql = migrations.map((name) => readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8")).join("\n");

describe("Prisma schema", () => {
  it("has no Agreement or LedgerEntry models, or their enums", () => {
    for (const name of ["Agreement", "LedgerEntry"]) expect(schema).not.toMatch(new RegExp(`^model ${name}\\b`, "m"));
    for (const name of ["AgreementKind", "AgreementStatus", "LedgerKind"]) expect(schema).not.toMatch(new RegExp(`^enum ${name}\\b`, "m"));
    expect(schema).not.toMatch(/agreementsAs(Owner|Tenant)/);
  });

  it("has one init migration that creates no Agreement or LedgerEntry tables and leaves spatial_ref_sys alone", () => {
    expect(migrations).toHaveLength(1);
    expect(migrations[0]).toMatch(/^\d{14}_init$/);
    expect(migrationSql).not.toMatch(/"Agreement"|"LedgerEntry"/);
    expect(migrationSql).not.toMatch(/spatial_ref_sys/);
  });

  it("drops Verification.brokerUserId and adds the briefed columns and indexes", () => {
    const model = (name: string) => schema.match(new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
    expect(model("Verification")).not.toMatch(/brokerUserId/);
    expect(model("BrokerProfile")).toMatch(/verifiedById\s+String\?/);
    expect(model("OtpChallenge")).toMatch(/ipHash\s+String\?/);
    expect(model("OtpChallenge")).toMatch(/@@index\(\[ipHash, createdAt\]\)/);
    expect(model("Outbox")).toMatch(/params\s+Json\?/);
    expect(model("Outbox")).toMatch(/language\s+Language\?/);
    expect(model("Outbox")).toMatch(/attempts\s+Int\s+@default\(0\)/);
    expect(model("Outbox")).toMatch(/providerMessageId\s+String\?/);
    expect(model("Outbox")).toMatch(/@@index\(\[status, createdAt\]\)/);
    expect(model("AuditEvent")).toMatch(/@@index\(\[createdAt\]\)/);
    expect(model("Listing")).toMatch(/number\s+Int\s+@unique @default\(autoincrement\(\)\)/);
  });
});
