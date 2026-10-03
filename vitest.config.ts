import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";

loadEnv({ quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST || "postgresql://chirunama:chirunama@localhost:5432/chirunama_test";

// Shared by both projects. WhatsApp credentials are blanked so tests never send real messages,
// whatever is in .env; tests that need them set their own.
const testEnv = {
  AUTH_SECRET: "test-only-auth-secret-0123456789abcdef",
  ADMIN_PHONES: "919000000900",
  WHATSAPP_TOKEN: "",
  WHATSAPP_PHONE_NUMBER_ID: "",
};

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
      "next/root-params": fileURLToPath(new URL("./test/root-params.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
          // Unit tests have no database; this address refuses connections so an accidental
          // query fails fast instead of touching a real database.
          env: { ...testEnv, DATABASE_URL: "postgresql://unit:unit@127.0.0.1:9/no_database_in_unit_tests" },
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["test/db-setup.ts"],
          fileParallelism: false,
          env: { ...testEnv, DATABASE_URL: testDatabaseUrl },
        },
      },
    ],
  },
});
