import { test, expect } from '@playwright/test';

test.describe('Admin - Search, Navigation & FOM Creation', () => {
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

  test('should navigate to Create FOM form and render required inputs and action buttons', async ({ page }) => {
    await page.goto('/admin/a/create');

    // Wait for Add New FOM title
    await expect(page.locator('h1:has-text("Add New"), h1:has-text("FOM")').first()).toBeVisible({ timeout: 15000 });

    // Form inputs should be present
    const nameInput = page.locator('#name, input[formControlName="name"], input[name="name"]');
    await expect(nameInput.first()).toBeAttached();

    // Action buttons (Cancel / Submit) should be present
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await expect(cancelBtn.first()).toBeVisible({ timeout: 10000 });
  });
});
