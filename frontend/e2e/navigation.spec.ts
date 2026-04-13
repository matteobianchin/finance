import { test, expect } from "@playwright/test";

test.describe("Navigazione sidebar", () => {
  test("homepage carica la dashboard overview", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/OpenBB/i);
    await expect(page.locator("aside")).toBeVisible();
  });

  test("link sidebar navigano correttamente", async ({ page }) => {
    await page.goto("/");

    const links = [
      { label: "Screener", url: "/screener" },
      { label: "Analisi", url: "/analisi" },
      { label: "Crypto", url: "/crypto" },
      { label: "Macro", url: "/macro" },
      { label: "Portfolio", url: "/portfolio" },
      { label: "Earnings", url: "/earnings" },
    ];

    for (const { label, url } of links) {
      await page.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test("ricerca ticker naviga alla pagina equity", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.getByPlaceholder(/Cerca ticker/i);
    await searchInput.fill("AAPL");
    await searchInput.press("Enter");
    await expect(page).toHaveURL("/equity/AAPL");
  });
});
