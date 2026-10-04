import { expect, test } from "@playwright/test";
import { accountMenu, DEV_CODE, enterCode, hasHorizontalScroll, openAccountMenu, PHONES, requestCode, signIn } from "./helpers";

// Phone sign-in through the real form, and signing out.

test("a broker signs in from the dashboard link and lands on their own dashboard", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL("/en/login?next=%2Fen%2Fdashboard");

  const code = await requestCode(page, PHONES.ramesh);
  await expect(page.getByText("Code sent to +91 ******0001. It expires in 5 minutes.")).toBeVisible();
  await expect(page.getByText(DEV_CODE)).toBeVisible();

  const wrong = code === "000000" ? "111111" : "000000";
  await enterCode(page, wrong);
  await expect(page.locator("#code-error")).toHaveText("That code is not right. Check it and try again.");
  await expect(page).toHaveURL(/\/en\/login/);

  await enterCode(page, code);
  await page.waitForURL("/en/dashboard");

  await expect(page.getByRole("link", { name: /Ramesh Realty/ })).toBeVisible();
  const pipeline = page.locator("section", { has: page.getByRole("heading", { name: "Leads pipeline" }) });
  await expect(pipeline.getByRole("link", { name: "TC-1003" }).first()).toBeVisible();
  await expect(pipeline.getByRole("link", { name: "TC-1005" }).first()).toBeVisible();
  await expect(page.getByText("Srinivas K.")).toBeVisible();
  // Expired listings show on the broker's own dashboard.
  await expect(page.getByRole("link", { name: "TC-1007" })).toBeVisible();
  // No sample-data note any more.
  await expect(page.getByText(/Sample data/)).toHaveCount(0);

  await openAccountMenu(page);
  const menu = accountMenu(page);
  await expect(menu.getByRole("link", { name: "My dashboard" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("an invalid number stays on the first step with the invalidPhone message", async ({ page }) => {
  await page.goto("/en/login");
  await page.locator("#phone").fill("12345");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator("#phone-error")).toHaveText("Enter a valid 10-digit Indian mobile number.");
  await expect(page.locator("#code")).toHaveCount(0);

  await page.locator("#phone").fill("5000000001");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator("#phone-error")).toHaveText("Enter a valid 10-digit Indian mobile number.");
});

test("a protocol-relative next is ignored: sign-in lands on /en", async ({ page }) => {
  await signIn(page, PHONES.buyerRahul, { next: "//evil.com", expectedPath: "/en" });
  await expect(page).toHaveURL("/en");
  expect(new URL(page.url()).host).toBe("localhost:3100");
});

test("a signed-in visitor to the login page goes straight to the safe next", async ({ page }) => {
  await signIn(page, PHONES.ownerVenkat, { next: "/en/listings", expectedPath: "/en/listings" });
  await page.goto("/en/login?next=%2Fen%2Flocality%2Fkazipet");
  await expect(page).toHaveURL("/en/locality/kazipet");
  await page.goto("/en/login?next=https%3A%2F%2Fevil.com");
  await expect(page).toHaveURL("/en");
  await page.goto("/en/login?next=%2Fen%2Flogin");
  await expect(page).toHaveURL("/en");
});

test("signing out returns to /en and the old session cookie no longer works", async ({ page, context }) => {
  await signIn(page, PHONES.ownerPadma);
  const before = (await context.cookies()).find((c) => c.name === "cn_session");
  expect(before?.value).toBeTruthy();
  expect(before).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });

  // The header shows the user's name (the seed gives Padma one).
  await expect(accountMenu(page).locator("summary")).toContainText("Padma Reddy");
  await openAccountMenu(page);
  await accountMenu(page).getByRole("button", { name: "Sign out" }).click();

  await page.waitForURL("/en");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "cn_session")).toBeUndefined();

  // Replaying the old cookie does not sign anyone in.
  await context.addCookies([{ ...before!, expires: -1 }]);
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL("/en/login?next=%2Fen%2Fdashboard");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("a new number signs in with no roles and sees their masked number", async ({ page }) => {
  await signIn(page, "9876500001");
  const summary = accountMenu(page).locator("summary");
  await expect(summary).toContainText("+91 ******0001");
  await openAccountMenu(page);
  await expect(accountMenu(page).getByRole("link", { name: "My dashboard" })).toHaveCount(0);
  await expect(accountMenu(page).getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test.describe("on a 375 px phone", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("the login page does not scroll sideways and its inputs are numeric", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.locator("#phone")).toHaveAttribute("inputmode", "numeric");
    await expect(page.locator("#phone")).toHaveAttribute("autocomplete", "tel-national");
    await expect(page.locator("#phone")).toHaveAttribute("maxlength", "10");
    await expect(page.locator("#phone-error")).toHaveAttribute("aria-live", "polite");
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.goto("/te/login");
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.goto("/en/login");
    await requestCode(page, PHONES.fieldExec);
    await expect(page.locator("#code")).toHaveAttribute("inputmode", "numeric");
    await expect(page.locator("#code")).toHaveAttribute("autocomplete", "one-time-code");
    await expect(page.locator("#code")).toHaveAttribute("pattern", "\\d{6}");
    await expect(page.locator("#code-error")).toHaveAttribute("aria-live", "polite");
    expect(await hasHorizontalScroll(page)).toBe(false);

    // Asking again within 30 seconds is refused but keeps the code step open.
    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.locator("#code-error")).toHaveText("Please wait 30 seconds before asking for another code.");
    await expect(page.locator("#code")).toBeVisible();

    // "Change number" goes back to the first step.
    await page.getByRole("button", { name: "Change number" }).click();
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("#code")).toHaveCount(0);
  });
});
