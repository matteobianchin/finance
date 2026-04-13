import { test, expect } from "@playwright/test";

test.describe("Pagina equity", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/equity/AAPL");
  });

  test("mostra il ticker nel titolo", async ({ page }) => {
    await expect(page.getByText("AAPL", { exact: false })).toBeVisible();
  });

  test("tabs indicatori, fondamentali, news, confronto visibili", async ({ page }) => {
    for (const tab of ["Indicatori", "Fondamentali", "News", "Confronto"]) {
      await expect(page.getByRole("button", { name: tab })).toBeVisible();
    }
  });

  test("switcher line/candle è presente", async ({ page }) => {
    await expect(page.getByRole("button", { name: /line/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /candle/i })).toBeVisible();
  });

  test("bottone watchlist presente", async ({ page }) => {
    const btn = page.getByRole("button", { name: /watchlist/i });
    await expect(btn).toBeVisible();
  });
});
