// Stands in for "next/root-params" under Vitest. Next.js replaces that module at build time;
// tests that need another locale can mock this module.
export async function lang(): Promise<string> {
  return "te";
}
