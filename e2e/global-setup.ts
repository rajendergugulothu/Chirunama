import { execFileSync } from "node:child_process";
import path from "node:path";

// Fresh, seeded test database before every end-to-end run (rate limits, sessions and the
// outbox start empty). Runs test/db-reset.ts in its own process with tsx, which loads the
// Prisma client and the seed the same way `npm run db:seed` does.
export default function globalSetup(): void {
  const root = path.resolve(__dirname, "..");
  execFileSync(path.join(root, "node_modules", ".bin", "tsx"), ["test/db-reset.ts"], { cwd: root, stdio: "inherit" });
}
