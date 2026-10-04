import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { seed } from "../../../prisma/seed";

// The first migration and the seed, against the test database. test/db-setup.ts has already
// dropped the schema, run `prisma migrate deploy` on it and seeded it once.

const ROOT = path.resolve(__dirname, "../../..");
const bin = (name: string) => path.join(ROOT, "node_modules", ".bin", name);

function run(command: string, args: string[], env: Record<string, string>) {
  return spawnSync(bin(command), args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120_000,
  });
}

async function counts() {
  const [cities, localities, users, brokerProfiles, listings, leads, favorites, documents, outbox] = await Promise.all([
    prisma.city.count(),
    prisma.locality.count(),
    prisma.user.count(),
    prisma.brokerProfile.count(),
    prisma.listing.count(),
    prisma.lead.count(),
    prisma.favorite.count(),
    prisma.document.count(),
    prisma.outbox.count(),
  ]);
  return { cities, localities, users, brokerProfiles, listings, leads, favorites, documents, outbox };
}

describe("init migration", () => {
  it("creates every app table on an empty database, and no Agreement or LedgerEntry table", async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const tables = rows.map((r) => r.table_name);
    for (const table of [
      "User",
      "Session",
      "OtpChallenge",
      "Agency",
      "BrokerProfile",
      "City",
      "Locality",
      "Property",
      "Unit",
      "Listing",
      "Lead",
      "Verification",
      "Document",
      "SavedSearch",
      "Favorite",
      "Review",
      "Flag",
      "Outbox",
      "ShareLink",
      "AuditEvent",
      "_prisma_migrations",
    ]) {
      expect(tables).toContain(table);
    }
    expect(tables).not.toContain("Agreement");
    expect(tables).not.toContain("LedgerEntry");

    const applied = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations`;
    expect(applied).toHaveLength(1);
    expect(applied[0].migration_name).toMatch(/_init$/);
    expect(applied[0].finished_at).not.toBeNull();
  });

  it("leaves the database exactly as the schema describes (no drift)", () => {
    const result = run(
      "prisma",
      ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"],
      { DATABASE_URL: process.env.DATABASE_URL! },
    );
    expect(result.stdout + result.stderr).toMatch(/No difference detected|empty migration/i);
    expect(result.status).toBe(0);
  }, 120_000);

  it("reports no pending migrations", () => {
    const result = run("prisma", ["migrate", "status"], { DATABASE_URL: process.env.DATABASE_URL! });
    expect(result.stdout).toMatch(/Database schema is up to date/);
    expect(result.status).toBe(0);
  }, 120_000);
});

describe("seed", () => {
  it("is idempotent: run twice, it leaves exactly the briefed rows", async () => {
    await seed(prisma);
    await seed(prisma);

    expect(await counts()).toEqual({
      cities: 1,
      localities: 5,
      users: 9,
      brokerProfiles: 2,
      listings: 7,
      leads: 6,
      favorites: 3,
      documents: 5,
      outbox: 0,
    });

    const localities = await prisma.locality.findMany({ select: { lat: true, lng: true } });
    expect(localities.every((l) => l.lat !== null && l.lng !== null)).toBe(true);

    const numbers = (await prisma.listing.findMany({ select: { number: true }, orderBy: { number: "asc" } })).map((l) => l.number);
    expect(numbers).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007]);

    const roles = (await prisma.user.findMany({ select: { roles: true } })).flatMap((u) => u.roles);
    for (const role of ["ADMIN", "ADVOCATE", "FIELD_EXECUTIVE"] as const) {
      expect(roles.filter((r) => r === role)).toHaveLength(1);
    }

    // The sequence has moved past the explicit numbers: the next listing gets 1008.
    const [sequence] = await prisma.$queryRaw<{ last_value: bigint; is_called: boolean }[]>`
      SELECT last_value, is_called FROM "Listing_number_seq"`;
    expect(Number(sequence.last_value) + (sequence.is_called ? 1 : 0)).toBe(1008);
  }, 60_000);

  it("refuses to run in production and changes nothing", async () => {
    await seed(prisma);
    // A marker row the seed would truncate if it ran.
    const marker = await prisma.outbox.create({
      data: { channel: "SMS", to: "919000000999", purpose: "seed_marker", body: "marker", status: "LOGGED" },
    });
    const before = await counts();

    const result = run("tsx", ["prisma/seed.ts"], { NODE_ENV: "production", DATABASE_URL: process.env.DATABASE_URL! });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/production/i);

    expect(await counts()).toEqual(before);
    expect(await prisma.outbox.findUnique({ where: { id: marker.id } })).not.toBeNull();

    // The exported seed() refuses too.
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(seed(prisma)).rejects.toThrow(/production/i);
    } finally {
      vi.unstubAllEnvs();
    }
    expect(await prisma.outbox.findUnique({ where: { id: marker.id } })).not.toBeNull();

    await seed(prisma);
  }, 120_000);
});
