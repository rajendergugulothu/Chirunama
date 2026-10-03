import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST || "postgresql://chirunama:chirunama@localhost:5432/chirunama_test";
const port = 3100;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The bundled Playwright expects a newer Chromium build than the one installed here.
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" },
      },
    },
  ],
  webServer: {
    // The server is started (and checked on /te, which reads the database) before the global
    // setup runs, so the test database is also reset here: the first run on a new machine
    // has no test database yet.
    command: `tsx test/db-reset.ts && next dev --port ${port}`,
    env: {
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_TEST: testDatabaseUrl,
      ADMIN_PHONES: "919000000900",
      // Sign-in codes stay in the outbox; never send real WhatsApp messages from tests.
      WHATSAPP_TOKEN: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
    },
    url: `${baseURL}/te`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
