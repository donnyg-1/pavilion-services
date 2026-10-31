import { expect, test } from "@playwright/test";

// End-to-end: resident books Gutter Day (address suggestion + test card), admin closes signups and charges the card.
// Needs fresh seed data (`npm run db:reset`) and mock payments. Uses a random address from the seed list.

const streets = Array.from({ length: 20 }, (_, i) => `${1200 + i * 20} N 500 E`).slice(4);

test.describe.configure({ mode: "serial" });

test("wallet button books in one tap", async ({ page }) => {
  await page.goto("/d/gutter-day?src=board");
  test.skip(await page.getByText("Signups are closed").isVisible(), "Signups already closed. Run `npm run db:reset` for fresh seed data.");
  await page.getByRole("button", { name: /Book with test wallet/ }).click();
  await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
});

let referrerToken = "";

test("a neighbor booking with your share link earns you credit", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/d/gutter-day?src=manager");
  test.skip(await a.getByText("Signups are closed").isVisible(), "Signups already closed. Run `npm run db:reset` for fresh seed data.");
  await a.getByRole("button", { name: /Book with test wallet/ }).click();
  await expect(a.getByRole("heading", { name: /You're booked/ })).toBeVisible();
  referrerToken = new URL(a.url()).pathname.split("/").pop()!;
  const shareUrl = (await a.getByTestId("share-url").textContent())!;
  await expect(a.getByTestId("referral-meter")).toContainText("No neighbors yet");

  const b = await (await browser.newContext()).newPage();
  await b.goto(shareUrl);
  await expect(b.getByText("A neighbor sent you this link")).toBeVisible();
  await b.getByRole("button", { name: /Book with test wallet/ }).click();
  await expect(b.getByRole("heading", { name: /You're booked/ })).toBeVisible();

  await a.reload();
  await expect(a.getByTestId("referral-meter")).toContainText("You've earned $3 off");
});

test("resident books, admin charges, ledger records it", async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const street = streets[Math.floor(Math.random() * streets.length)].replace(" N ", " North ").replace(" E", " East");

  await page.goto("/d/gutter-day?src=flyer");
  await expect(page.getByRole("heading", { name: "Gutter Day" })).toBeVisible();
  test.skip(await page.getByText("Signups are closed").isVisible(), "Signups already closed. Run `npm run db:reset` for fresh seed data.");

  await page.fill("#name", "E2E Resident");
  await page.fill("#email", email);
  await page.fill("#phone", "801-555-0111");
  await page.fill("#street", "1 Not A Real Rd");
  await page.getByRole("button", { name: /^Book for/ }).click();
  await expect(page.getByText("Not on the list? Request review")).toBeVisible();

  // Typing a messy version of the address offers the real one from the community list.
  await page.fill("#street", "");
  await page.locator("#street").pressSequentially(street.split(" ").slice(0, 2).join(" "), { delay: 30 });
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: /^Book for/ }).click();
  const outcome = await Promise.race([
    page.waitForURL(/\/b\//).then(() => "booked"),
    page.getByText("already booked").waitFor().then(() => "taken"),
  ]);
  test.skip(outcome === "taken", "Random address was already booked by an earlier run");

  await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
  await expect(page.getByTestId("share-url")).toContainText("ref=");

  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  admin.on("dialog", (d) => d.accept());
  await admin.goto("/admin/login");
  await admin.fill("#password", process.env.ADMIN_PASSWORD ?? "pavilion");
  await admin.click("button[type=submit]");
  await admin.getByRole("link", { name: /Gutter Day/ }).first().click();
  await admin.waitForURL(/\/admin\/deals\//);
  const dealUrl = admin.url().split("?")[0];

  if (await admin.getByRole("button", { name: "Close signups now" }).isVisible()) {
    await admin.getByRole("button", { name: "Close signups now" }).click();
    await expect(admin.getByText("Signups closed and the price is locked.")).toBeVisible();
  }
  await admin.goto(`${dealUrl}?tab=bookings&status=booked`);
  const row = admin.locator("tr").filter({ hasText: email });
  await row.getByRole("button", { name: "Complete & charge" }).click();
  await expect(admin.getByText(/Charged \$/)).toBeVisible();

  await admin.goto(`${dealUrl}?tab=ledger`);
  await expect(admin.locator("tr", { hasText: "E2E Resident" }).first()).toBeVisible();
});

test("the referrer is charged $3 less", async ({ browser }) => {
  test.skip(!referrerToken, "Referral booking didn't run");
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  admin.on("dialog", (d) => d.accept());
  await admin.goto("/admin/login");
  await admin.fill("#password", process.env.ADMIN_PASSWORD ?? "pavilion");
  await admin.click("button[type=submit]");
  await admin.getByRole("link", { name: /Gutter Day/ }).first().click();
  await admin.waitForURL(/\/admin\/deals\//);
  const dealUrl = admin.url().split("?")[0];
  await admin.goto(`${dealUrl}?tab=bookings&status=booked`);
  const row = admin.locator("tr").filter({ has: admin.locator(`a[href="/b/${referrerToken}"]`) });
  await expect(row).toContainText("Referred 1 neighbor");
  await expect(row).toContainText("after −$3.00 referral");
  await row.getByRole("button", { name: "Complete & charge" }).click();
  await expect(admin.getByText(/Charged \$/)).toBeVisible();
  await admin.goto(`${dealUrl}?tab=ledger`);
  await expect(admin.getByText("after -$3.00 referral").or(admin.getByText("after −$3.00 referral")).first()).toBeVisible();
});
