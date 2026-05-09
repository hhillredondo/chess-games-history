import { expect, test, type Page } from "@playwright/test";

async function mockEmptyApis(page: Page): Promise<void> {
  await page.route("**/api/cache**", async (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/games**", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ games: [], cursors: {}, hasMore: false }),
    })
  );
  // Coach is never invoked in these tests — block the endpoint to be safe.
  await page.route("**/api/coach**", async (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
  );
}

test.describe("Coach view", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyApis(page);
  });

  test("loads under the Coach tab without errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/coach?chesscom=alice");
    await expect(
      page.getByRole("tab", { name: "Coach" })
    ).toHaveAttribute("aria-selected", "true");

    // The page should render without runtime errors even when no games exist.
    expect(consoleErrors).toEqual([]);
  });
});
