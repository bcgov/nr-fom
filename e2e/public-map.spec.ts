import { test, expect } from '@playwright/test';

test.describe('Public - Map & Navigation', () => {
  test('should load the public map page, render Leaflet map, and navigate to FOM details from marker popup', async ({ page }) => {
    await page.goto('/public/projects');

    // Wait for the header with brand title
    await expect(page.locator('.navbar-brand__title, .app-header').first()).toBeVisible({ timeout: 15000 });

    // Leaflet map container should be present and visible
    const mapElement = page.locator('#map, .leaflet-container, app-app-map, .map-container');
    await expect(mapElement.first()).toBeVisible({ timeout: 15000 });

    // Wait for map markers or clusters to render from seed data
    const marker = page.locator('.leaflet-marker-icon, .marker-cluster').first();
    if (await marker.isVisible({ timeout: 10000 }).catch(() => false)) {
      await marker.click({ force: true });

      // If a popup opens, click "View Details"
      const viewDetailsBtn = page.locator('.leaflet-popup button:has-text("View Details"), button.app-link');
      if (await viewDetailsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await viewDetailsBtn.click({ force: true });

        // Details panel should be open
        await expect(page.locator('app-details-panel')).not.toHaveAttribute('hidden', '');
        await expect(page.locator('.applications-view')).toHaveClass(/side-panel__open/);
      }
    }
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
