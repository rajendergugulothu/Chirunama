import { expect, test } from "@playwright/test";

// Signed-out visitors: the public pages read the seeded database, protected areas send them to
// sign in, and share links remember where the visitor came from.

test.describe("public pages, signed out", () => {
  test("home in Telugu shows seeded listings", async ({ page }) => {
    const response = await page.goto("/te");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("హంటర్ రోడ్‌లో గ్రౌండ్ ఫ్లోర్ షాప్")).toBeVisible();
    await expect(page.getByText("అనుమతి పొందిన లేఅవుట్‌లో 200 చ. గజాల ప్లాట్").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "మడికొండ", exact: true })).toHaveAttribute("href", "/te/locality/madikonda");
  });

  test("listings search shows live listings and not the expired TC-1007", async ({ page }) => {
    const response = await page.goto("/en/listings");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("2 BHK flat near Hanamkonda bus stand")).toBeVisible();
    await expect(page.getByText("Single room for students near NIT Warangal")).toBeVisible();
    for (const code of ["TC-1001", "TC-1002", "TC-1003", "TC-1004", "TC-1005", "TC-1006"]) {
      await expect(page.getByRole("link", { name: new RegExp(code) })).toBeVisible();
    }
    await expect(page.getByText("TC-1007")).toHaveCount(0);
    await expect(page.getByText("1 BHK portion near Kakatiya University")).toHaveCount(0);
  });

  test("listings search applies filters from the query string", async ({ page }) => {
    await page.goto("/en/listings?category=rental&maxPrice=5000");
    await expect(page.getByText("Single room for students near NIT Warangal")).toBeVisible();
    await expect(page.getByText("2 BHK flat near Hanamkonda bus stand")).toHaveCount(0);
  });

  test("TC-1004 shows its title and the Documents checked badge", async ({ page }) => {
    const response = await page.goto("/en/listings/TC-1004");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "200 sq. yd plot in approved layout" })).toBeVisible();
    await expect(page.getByText("Documents checked").first()).toBeVisible();
  });

  test("listing codes are matched case-insensitively", async ({ page }) => {
    const response = await page.goto("/en/listings/tc-1004");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "200 sq. yd plot in approved layout" })).toBeVisible();
  });

  test("an unknown listing is a 404", async ({ page }) => {
    const response = await page.goto("/en/listings/TC-9999");
    expect(response?.status()).toBe(404);
  });

  test("Madikonda locality page in Telugu shows its plot", async ({ page }) => {
    const response = await page.goto("/te/locality/madikonda");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /మడికొండ/ }).first()).toBeVisible();
    await expect(page.getByText("అనుమతి పొందిన లేఅవుట్‌లో 200 చ. గజాల ప్లాట్")).toBeVisible();
  });

  test("Ramesh Realty's profile shows the broker and live listings only", async ({ page }) => {
    const response = await page.goto("/en/agent/ramesh-realty");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Ramesh Realty" })).toBeVisible();
    await expect(page.getByText("Ground-floor shop on Hunter Road")).toBeVisible();
    await expect(page.getByText("Independent house, 3 BHK, east facing")).toBeVisible();
    await expect(page.getByText("Usually replies in 20 min")).toBeVisible();
    await expect(page.getByText("1 BHK portion near Kakatiya University")).toHaveCount(0);
  });
});

test.describe("header and protected areas, signed out", () => {
  test("the header shows Sign in, in each language, linking back to the page", async ({ page }) => {
    await page.goto("/en/listings");
    const signIn = page.getByRole("banner").getByRole("link", { name: "Sign in" });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/en/login?next=%2Fen%2Flistings");

    await page.goto("/te");
    await expect(page.getByRole("banner").getByRole("link", { name: "సైన్ ఇన్" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toHaveCount(0);
  });

  test("the dashboard sends a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL("/en/login?next=%2Fen%2Fdashboard");
    await expect(page.getByRole("heading", { name: "Sign in with your phone" })).toBeVisible();
  });

  test("the admin area sends a signed-out visitor to sign in, not a 404", async ({ page }) => {
    await page.goto("/en/admin/outbox");
    await expect(page).toHaveURL("/en/login?next=%2Fen%2Fadmin%2Foutbox");
    await page.goto("/te/admin");
    await expect(page).toHaveURL("/te/login?next=%2Fte%2Fadmin");
  });

  test("the login page is not indexed", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("documents are a 404 when signed out", async ({ request }) => {
    const response = await request.get("/api/files/documents/seed/tc-1004-title.pdf");
    expect(response.status()).toBe(404);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("share link attribution", () => {
  test("?src= on a localised page sets cn_src", async ({ page, context, request }) => {
    const response = await request.get("/te/agent/ramesh-realty?src=Instagram", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const header = response.headersArray().find((h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith("cn_src="));
    expect(header?.value).toMatch(/^cn_src=INSTAGRAM;/);
    expect(header?.value).toMatch(/Max-Age=2592000/);
    expect(header?.value).toMatch(/HttpOnly/i);
    expect(header?.value).toMatch(/SameSite=lax/i);

    await page.goto("/te/agent/ramesh-realty?src=Instagram");
    const cookie = (await context.cookies()).find((c) => c.name === "cn_src");
    expect(cookie).toMatchObject({ value: "INSTAGRAM", httpOnly: true, sameSite: "Lax", path: "/" });
    // The existing lang cookie is still set.
    expect((await context.cookies()).find((c) => c.name === "lang")?.value).toBe("te");
  });

  test("an unlocalised share link redirects, keeps ?src= and sets cn_src", async ({ page, context }) => {
    await context.addCookies([{ name: "lang", value: "en", url: "http://localhost:3100" }]);
    await page.goto("/agent/ramesh-realty?src=qr");
    await expect(page).toHaveURL("/en/agent/ramesh-realty?src=qr");
    expect((await context.cookies()).find((c) => c.name === "cn_src")?.value).toBe("QR");
  });

  test("an unknown source is ignored and the latest valid one wins", async ({ page, context }) => {
    await page.goto("/en/listings?src=bogus");
    expect((await context.cookies()).find((c) => c.name === "cn_src")).toBeUndefined();
    await page.goto("/en/listings?src=whatsapp");
    await page.goto("/en/listings?src=bogus");
    await page.goto("/en/listings?src=Facebook");
    expect((await context.cookies()).find((c) => c.name === "cn_src")?.value).toBe("FACEBOOK");
  });
});
