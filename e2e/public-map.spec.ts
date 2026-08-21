import { test, expect } from '@playwright/test';

test.describe('Public - Map & Navigation', () => {
  test('should load the public map page and render header branding and Leaflet map', async ({ page }) => {
    await page.goto('/public/projects');

    // Wait for the header with brand title
    await expect(page.locator('.navbar-brand__title, .app-header').first()).toBeVisible({ timeout: 15000 });

    // Leaflet map container should be present and visible
    const mapElement = page.locator('#map, .leaflet-container, app-app-map, .map-container');
    await expect(mapElement.first()).toBeVisible({ timeout: 15000 });
  });

  test('should allow toggling between Find FOMs panel and Public Notices', async ({ page }) => {
    await page.goto('/public/projects');

    // Check presence of navigation or action tabs
    const findTab = page.locator('.side-nav button:has-text("Find")');
    const noticesTab = page.locator('.side-nav button:has-text("Public Notices")');

    await expect(findTab.first()).toBeVisible({ timeout: 10000 });
    await expect(noticesTab.first()).toBeVisible({ timeout: 10000 });

    // Toggle Public Notices panel
    await noticesTab.first().click();
    await expect(page.locator('app-public-notices-panel, .side-panel').first()).toBeVisible({ timeout: 5000 });
  });
});
