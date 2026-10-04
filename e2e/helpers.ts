import { expect, type Page } from "@playwright/test";

// Shared steps for the end-to-end specs. Sign-in goes through the real login form; the code is
// read from the development-only note (NODE_ENV is not production under `next dev`).
//
// Rate limits apply to the whole run: every spec signs in with its own phone number, so the
// 30-second cooldown and 3-per-15-minutes limit never trip, and the run stays well under the
// 20-codes-per-hour limit for the single local IP.

export const PHONES = {
  ramesh: "9000000001",
  kazipetHomes: "9000000002",
  ownerVenkat: "9000000101",
  ownerPadma: "9000000102",
  admin: "9000000900",
  advocate: "9000000901",
  fieldExec: "9000000902",
  buyerSwathi: "9000000301",
  buyerRahul: "9000000302",
} as const;

export const DEV_CODE = /Development only: your code is (\d{6})/;

// Fills in the number and waits for the code step; returns the development code.
export async function requestCode(page: Page, phone: string): Promise<string> {
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const note = page.getByText(DEV_CODE);
  await expect(note).toBeVisible();
  return DEV_CODE.exec((await note.textContent()) ?? "")![1];
}

export async function enterCode(page: Page, code: string): Promise<void> {
  await page.locator("#code").fill(code);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
}

// Signs in through /en/login and waits to land on `expectedPath` (by default the safe `next`,
// or /en).
export async function signIn(page: Page, phone: string, options: { next?: string; expectedPath?: string } = {}): Promise<void> {
  const query = options.next === undefined ? "" : `?next=${encodeURIComponent(options.next)}`;
  await page.goto(`/en/login${query}`);
  const code = await requestCode(page, phone);
  await enterCode(page, code);
  await page.waitForURL((url) => url.pathname === (options.expectedPath ?? options.next ?? "/en"));
}

// The header's account menu (a <details> element).
export function accountMenu(page: Page) {
  return page.locator("header details");
}

export async function openAccountMenu(page: Page): Promise<void> {
  const menu = accountMenu(page);
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
}

// True when the page is wider than the viewport (horizontal scrolling).
export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}
