import { expect, test } from "@playwright/test";
import { accountMenu, openAccountMenu, PHONES, signIn } from "./helpers";

// What each kind of signed-in user can and cannot see.

test("Kazipet Homes sees only its own listings and none of Ramesh's leads", async ({ page }) => {
  await signIn(page, PHONES.kazipetHomes, { next: "/en/dashboard" });

  await expect(page.getByRole("link", { name: /Kazipet Homes/ })).toBeVisible();
  const performance = page.locator("section", { has: page.getByRole("heading", { name: "Listing performance" }) });
  await expect(performance.getByRole("link", { name: "TC-1002" })).toBeVisible();
  await expect(performance.getByRole("link", { name: "TC-1006" })).toBeVisible();
  await expect(performance.locator("tbody tr")).toHaveCount(2);

  for (const code of ["TC-1003", "TC-1005", "TC-1007"]) await expect(page.getByText(code)).toHaveCount(0);
  for (const name of ["Srinivas K.", "Dr. Anitha R.", "Praveen M.", "Lakshmi Traders", "Ravi Teja P.", "Sai Mobiles"]) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
  await expect(page.getByText("Ramesh Realty")).toHaveCount(0);
});

test("a buyer gets the not-linked panel and a 404 for the admin area", async ({ page, request }) => {
  await signIn(page, PHONES.buyerSwathi, { next: "/en/dashboard" });

  const dashboard = await page.goto("/en/dashboard");
  expect(dashboard?.status()).toBe(200);
  await expect(
    page.getByText("Your number is not linked to a broker profile yet. Message us on WhatsApp to set one up."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Message us" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+$/);
  await expect(page.getByText("Leads pipeline")).toHaveCount(0);

  const outbox = await page.goto("/en/admin/outbox");
  expect(outbox?.status()).toBe(404);
  await expect(page.getByText("Message outbox")).toHaveCount(0);
  const admin = await page.goto("/en/admin");
  expect(admin?.status()).toBe(404);

  // Another user's document is a 404 too.
  const file = await page.request.get("/api/files/documents/seed/tc-1004-title.pdf");
  expect(file.status()).toBe(404);

  await page.goto("/en");
  await openAccountMenu(page);
  await expect(accountMenu(page).getByRole("link", { name: "My dashboard" })).toHaveCount(0);
  await expect(accountMenu(page).getByRole("link", { name: "Admin" })).toHaveCount(0);

  // A request without the browser's cookies is signed out: still the login redirect.
  const signedOut = await request.get("/en/admin/outbox", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect(signedOut.headers()["location"]).toContain("/en/login?next=%2Fen%2Fadmin%2Foutbox");
});

test("the admin sees the outbox with redacted sign-in codes", async ({ page }) => {
  await signIn(page, PHONES.admin);

  await openAccountMenu(page);
  const adminLink = accountMenu(page).getByRole("link", { name: "Admin" });
  await expect(adminLink).toBeVisible();
  await adminLink.click();
  await page.waitForURL("/en/admin");
  await page.getByRole("link", { name: /Message outbox/ }).click();
  await page.waitForURL("/en/admin/outbox");

  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  // The admin's own sign-in code from this run is listed, as Logged and redacted.
  const own = rows.filter({ hasText: "+919000000900" });
  await expect(own.first()).toBeVisible();

  for (let i = 0; i < count; i++) {
    const cells = rows.nth(i).locator("td");
    await expect(cells.nth(3)).toHaveText("otp");
    await expect(cells.nth(4)).toHaveText("Logged (not sent)");
    const message = (await cells.nth(5).textContent()) ?? "";
    expect(message).toContain("••••••");
    expect(message).not.toMatch(/\d{6}/);
  }

  await page.goto("/en/admin/outbox?status=SENT");
  await expect(page.getByText("No messages yet.")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);

  // The admin can read documents.
  const file = await page.request.get("/api/files/documents/seed/tc-1004-title.pdf");
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("application/pdf");
  expect(file.headers()["content-disposition"]).toMatch(/^attachment/);
  expect(file.headers()["cache-control"]).toBe("private, no-store");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");
});

test("the advocate can read documents but not the admin area", async ({ page }) => {
  await signIn(page, PHONES.advocate);
  const file = await page.request.get("/api/files/documents/seed/tc-1004-title.pdf");
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("application/pdf");
  expect((await page.goto("/en/admin/outbox"))?.status()).toBe(404);
});
