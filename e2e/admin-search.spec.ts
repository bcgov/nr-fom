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

  test('should restrict FOM Number and FSP ID inputs to digits only and maximum 9 digits', async ({ page }) => {
    await page.goto('/admin');

    const fNumberInput = page.locator('#fNumberInput');
    const fspIdInput = page.locator('#fspIdInput');

    await expect(fNumberInput).toBeVisible({ timeout: 10000 });
    await expect(fspIdInput).toBeVisible({ timeout: 10000 });

    // Typing non-digit characters should be ignored
    await fNumberInput.fill('');
    await fNumberInput.pressSequentially('abc-123+xyz');
    await expect(fNumberInput).toHaveValue('123');

    // Overlong input should be clamped to 9 digits
    await fNumberInput.fill('');
    await fNumberInput.pressSequentially('123456789012345');
    await expect(fNumberInput).toHaveValue('123456789');

    // Typing initial 0 should be stripped
    await fspIdInput.fill('');
    await fspIdInput.pressSequentially('000123');
    await expect(fspIdInput).toHaveValue('123');

    // Pasting leading zeros with >9 digits should strip zeros and clamp to 9 digits
    await fspIdInput.fill('');
    await fspIdInput.evaluate((el: HTMLInputElement) => {
      const dt = new DataTransfer();
      dt.setData('text', '0009876543219999');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(fspIdInput).toHaveValue('987654321');

    // Executing search with 9 digits should not throw an internal server error snackbar
    const searchBtn = page.locator('button[type="submit"], .filter-btn-search');
    await searchBtn.click();

    // Verify search completed without error snackbar
    await expect(page.getByText('Error searching foms')).toBeHidden();
    await expect(page.locator('.search-results-container')).toBeVisible();
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
