// Rebuilds the test database from scratch: create it if missing, drop and recreate the public
// schema, enable PostGIS, apply every migration, then seed. Used by the Vitest `db` project and
// by the Playwright global setup. Refuses any database whose name does not end in _test.
//
// Run directly with: npx tsx test/db-reset.ts

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seed } from "../prisma/seed";

export const DEFAULT_TEST_DATABASE_URL = "postgresql://chirunama:chirunama@localhost:5432/chirunama_test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function testDatabaseUrl(): string {
  return process.env.DATABASE_URL_TEST || DEFAULT_TEST_DATABASE_URL;
}

function client(url: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function resetTestDatabase(url: string = testDatabaseUrl()): Promise<void> {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Refusing to reset "${name}": the test database name must end in _test.`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const admin = client(adminUrl.toString());
  try {
    const existing = await admin.$queryRaw<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  const db = client(url);
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.$executeRawUnsafe(`CREATE SCHEMA public`);
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS postgis`);
    execFileSync(path.join(ROOT, "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
    await seed(db);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const { config } = await import("dotenv");
    config({ quiet: true });
    await resetTestDatabase();
    console.log(`Reset ${new URL(testDatabaseUrl()).pathname.slice(1)}: migrated and seeded.`);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
