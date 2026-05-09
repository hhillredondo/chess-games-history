import { expect, test } from "@playwright/test";

test.describe("Home page", () => {
  test("renders the search form and headline", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Look up Chess.com and Lichess games/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/hikaru/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("submitting a username navigates to /stats with query params", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/hikaru/i).fill("alice");
    await page.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/\/stats\?/);
    expect(page.url()).toContain("chesscom=alice");
    expect(page.url()).toContain("lichess=alice");
  });

  test("unchecking 'same username' reveals the Lichess input", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Same username on both sites/i).uncheck();
    await expect(page.getByPlaceholder(/erik/i)).toBeVisible();
    await expect(page.getByPlaceholder(/DrNykterstein/i)).toBeVisible();
  });
});
