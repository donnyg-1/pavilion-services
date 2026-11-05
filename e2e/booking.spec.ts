import { expect, test } from "@playwright/test";

// End-to-end: resident books Gutter Day (address suggestion + test card), admin closes signups and charges the card.
// Needs fresh seed data (`npm run db:reset`) and mock payments. Uses a random address from the seed list.

const streets = Array.from({ length: 20 }, (_, i) => `${1200 + i * 20} N 500 E`).slice(4);

test.describe.configure({ mode: "serial" });

test("wallet button books in one tap", async ({ page }) => {
  await page.goto("/d/gutter-day?src=board");
  test.skip(await page.getByText("Signups are closed").isVisible(), "Signups already closed. Run `npm run db:reset` for fresh seed data.");
  // The form doesn't ask about texts; the booking page does, right after booking.
  await expect(page.getByText(/Text me/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Book now, pay after the job" })).toBeVisible();
  await page.getByRole("button", { name: /Book with test wallet/ }).click();
  await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
  await expect(page.getByText("Want a text when the crew's on the way?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Text me reminders" })).toBeVisible();
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
  // An address that isn't on the community list is flagged as soon as they leave the field.
  await page.fill("#street", "1 Not A Real Rd");
  await page.locator("#street").blur();
  await expect(page.getByText(/We can't find this address/)).toBeVisible();
  await expect(page.getByText("Not on the list? Request review")).toBeVisible();

  // Typing a messy version of the address offers the real one from the community list.
  await page.fill("#street", "");
  await page.locator("#street").pressSequentially(street.split(" ").slice(0, 2).join(" "), { delay: 30 });
  await page.getByRole("option").first().click();
  await expect(page.getByTestId("address-ok")).toContainText("On ");
  await page.getByRole("button", { name: "Book now, pay after the job" }).click();
  const outcome = await Promise.race([
    page.waitForURL(/\/b\//).then(() => "booked"),
    page.getByText("already booked").waitFor().then(() => "taken"),
  ]);
  test.skip(outcome === "taken", "Random address was already booked by an earlier run");

  await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
  await expect(page.getByTestId("share-url")).toContainText("ref=");
  // One tap turns on texts and sends the confirmation text.
  await page.getByRole("button", { name: "Yes, text me" }).click();
  await expect(page.getByText("Texts are on. We'll text (801) 555-0111")).toBeVisible();
  await expect(page.getByText("On, to (801) 555-0111")).toBeVisible();

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

  // Closing signups emailed the vendor their route list; staff can resend it.
  await admin.getByRole("button", { name: "Email route list to vendor" }).click();
  await expect(admin.getByText(/Emailed the route list \(\d+ homes?\) to crew@example.com/)).toBeVisible();

  const row = admin.locator("tr").filter({ hasText: email });
  await row.getByRole("button", { name: "Text: crew on the way" }).click();
  await expect(admin.getByText("Texted E2E Resident: crew on the way.")).toBeVisible();
  await row.getByRole("button", { name: "Complete & charge" }).click();
  await expect(admin.getByText(/Charged \$/)).toBeVisible();

  await admin.goto(`${dealUrl}?tab=ledger`);
  await expect(admin.locator("tr", { hasText: "E2E Resident" }).first()).toBeVisible();

  // Both texts this resident got are in the Outbox, next to the vendor's route emails.
  await admin.goto("/admin/outbox");
  await expect(admin.locator("tr", { hasText: "crew@example.com" }).filter({ hasText: /^.*Route list: Gutter Day/ }).first()).toBeVisible();
  await expect(admin.locator("tr", { hasText: "Updated route list: Gutter Day" }).first()).toBeVisible();
  const texts = admin.locator("tr", { hasText: "+18015550111" });
  await expect(texts.filter({ hasText: "booking confirmed" })).toHaveCount(1);
  await expect(texts.filter({ hasText: "on the way" })).toHaveCount(1);
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

test("a vendor with missing paperwork is flagged", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill("#password", process.env.ADMIN_PASSWORD ?? "pavilion");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.includes("login"));
  await page.goto("/admin/vendors");

  const card = page.locator("details", { hasText: "Example Gutter Co." });
  await expect(card.getByText("Ready", { exact: true })).toBeVisible();
  await card.locator("summary").click();
  const agreement = card.getByLabel("Agreement signed");
  const signed = await agreement.inputValue();
  await agreement.fill("");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Missing: Signed vendor agreement")).toBeVisible();

  // Put it back for the next run.
  await agreement.fill(signed);
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Ready", { exact: true })).toBeVisible();
});
