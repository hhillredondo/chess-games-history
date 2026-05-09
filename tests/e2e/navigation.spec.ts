import { expect, test, type Page } from "@playwright/test";

/**
 * Mocks both /api/cache (404 — the cache endpoint isn't deployed locally) and
 * /api/games (empty result), so the app reaches a "ready, no games" state
 * deterministically without hitting Chess.com or Lichess.
 */
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
}

test.describe("Tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyApis(page);
  });

  test("Analytics page renders the three-tab nav with Analytics selected", async ({ page }) => {
    await page.goto("/stats?chesscom=alice&lichess=alice");
    const tablist = page.getByRole("tablist", { name: "View" });
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole("tab", { name: "Analytics" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(tablist.getByRole("tab", { name: "Games" })).toBeVisible();
    await expect(tablist.getByRole("tab", { name: "Coach" })).toBeVisible();
  });

  test("clicking Games and Coach tabs preserves the username query", async ({ page }) => {
    await page.goto("/stats?chesscom=alice&lichess=alice");

    await page.getByRole("tab", { name: "Games" }).click();
    await page.waitForURL(/\/games\?/);
    expect(page.url()).toContain("chesscom=alice");
    await expect(
      page.getByRole("tab", { name: "Games" })
    ).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Coach" }).click();
    await page.waitForURL(/\/coach\?/);
    expect(page.url()).toContain("chesscom=alice");
    await expect(
      page.getByRole("tab", { name: "Coach" })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("the back-to-search link returns to /", async ({ page }) => {
    await page.goto("/stats?chesscom=alice");
    await page.getByRole("link", { name: /Search/i }).first().click();
    await page.waitForURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Look up Chess.com and Lichess games/i })
    ).toBeVisible();
  });
});
