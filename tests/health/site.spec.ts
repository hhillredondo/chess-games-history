import { expect, test } from "@playwright/test";

/**
 * Health check against the deployed CloudFront URL. Run via:
 *   npm run test:health
 *   HEALTH_CHECK_URL=https://example.com npm run test:health
 */

test.describe("Deployed site health check", () => {
  test("home page returns 200 and renders the headline", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /Look up Chess.com and Lichess games/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("API /api/games is reachable and validates input", async ({ request }) => {
    // No query params → handler returns 400 with an error message. This proves
    // the Lambda is wired to CloudFront and responding, without depending on
    // Chess.com or Lichess being up.
    const response = await request.get("/api/games");
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("static assets are served (favicon)", async ({ request }) => {
    const response = await request.get("/favicon.ico");
    // 200 if present, 304 if cached. Either is healthy; 5xx is not.
    expect(response.status()).toBeLessThan(400);
  });
});
