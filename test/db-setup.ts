import { resetTestDatabase } from "./db-reset";

// Vitest global setup for the `db` project: one fresh, seeded test database per run.
export default async function setup(): Promise<void> {
  await resetTestDatabase();
}
