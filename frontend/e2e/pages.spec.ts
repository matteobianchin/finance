import { test, expect } from "@playwright/test";

test.describe("Pagina Screener", () => {
  test("carica la tabella screener", async ({ page }) => {
    await page.goto("/screener");
    await expect(page.getByRole("heading", { name: /screener/i })).toBeVisible();
    // Filtri presenti
    await expect(page.getByText(/RSI/i)).toBeVisible();
  });
});

test.describe("Pagina Analisi", () => {
  test("carica la pagina analisi quantitativa", async ({ page }) => {
    await page.goto("/analisi");
    await expect(page.getByRole("heading", { name: /analisi quantitativa/i })).toBeVisible();
  });

  test("timeframe buttons presenti", async ({ page }) => {
    await page.goto("/analisi");
    for (const tf of ["3M", "6M", "1Y", "5Y"]) {
      await expect(page.getByRole("button", { name: tf })).toBeVisible();
    }
  });
});

test.describe("Pagina Macro", () => {
  test("carica le serie FRED", async ({ page }) => {
    await page.goto("/macro");
    await expect(page.getByRole("heading", { name: /macro/i })).toBeVisible();
  });
});

test.describe("Pagina Portfolio", () => {
  test("mostra import CSV", async ({ page }) => {
    await page.goto("/portfolio");
    await expect(page.getByText(/import/i)).toBeVisible();
  });
});
