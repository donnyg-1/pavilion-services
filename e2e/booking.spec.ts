import { expect, test } from "@playwright/test";

// End-to-end: resident books Gutter Day, admin closes signups and charges the card.
// Needs fresh seed data (`npm run db:reset`) and mock payments. Uses a random address from the seed list.

const streets = Array.from({ length: 20 }, (_, i) => `${1200 + i * 20} N 500 E`).slice(4);

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
  await page.check("input[name=agreed]");
  await page.click("button[type=submit]");
  await expect(page.getByText("Not on the list? Request review")).toBeVisible();

  await page.fill("#street", street);
  await page.click("button[type=submit]");
  const outcome = await Promise.race([
    page.waitForURL(/mock-checkout/).then(() => "checkout"),
    page.getByText("already booked").waitFor().then(() => "taken"),
  ]);
  test.skip(outcome === "taken", "Random address was already booked by an earlier run");

  await page.getByRole("button", { name: "Save card" }).click();
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
  const row = admin.locator("tr", { hasText: "E2E Resident" }).filter({ hasText: email });
  await row.getByRole("button", { name: "Complete & charge" }).click();
  await expect(admin.getByText(/Charged \$/)).toBeVisible();

  await admin.goto(`${dealUrl}?tab=ledger`);
  await expect(admin.locator("tr", { hasText: "E2E Resident" }).first()).toBeVisible();
});
