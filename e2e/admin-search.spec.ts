import { test, expect } from '@playwright/test';

test.describe('Admin - Search & Dashboard', () => {
  test('should load the admin application shell and navigation header', async ({ page }) => {
    await page.goto('/admin');

    // Wait for the admin header branding
    await expect(page.locator('.navbar-brand, .app-header, header').first()).toBeVisible({ timeout: 15000 });
  });

  test('should display search form, FOM number input, and search action on search view', async ({ page }) => {
    await page.goto('/admin');

    // Search header title
    await expect(page.locator('h1:has-text("Search FOMs"), .title-container__title').first()).toBeVisible({ timeout: 15000 });

    // Search input for FOM number
    const fNumberInput = page.locator('#fNumberInput, input[name="fNumber"]');
    await expect(fNumberInput.first()).toBeVisible({ timeout: 10000 });

    // Search submit button
    const searchBtn = page.locator('button[type="submit"], .filter-btn-search, button:has-text("Search")');
    await expect(searchBtn.first()).toBeVisible({ timeout: 10000 });
  });
});
