import { test, expect } from '@playwright/test';

test.describe('Admin - Analytics Dashboard', () => {
  test('should load the dashboard and render apexcharts correctly', async ({ page }) => {
    // Navigate to the analytics dashboard directly.
    // Auth is bypassed/stubbed in the e2e environment via SECURITY_ENABLED=false
    await page.goto('/admin/analytics-dashboard');

    // Verify page title
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 15000 });
    
    // Wait for the Angular component's 500ms ngAfterViewInit delay and chart rendering
    // We expect exactly 5 charts to be rendered on the dashboard
    const chartCanvases = page.locator('.apexcharts-canvas, .apexcharts-svg');
    
    // Wait until there are at least 5 canvases on the page
    await expect(async () => {
      const count = await chartCanvases.count();
      expect(count).toBeGreaterThanOrEqual(5);
    }).toPass({ timeout: 10000 });

    // Verify all 5 expected chart wrappers are visible
    await expect(page.locator('#public-engagement-overview apx-chart').first()).toBeVisible();
    await expect(page.locator('#most-commented-foms apx-chart')).toBeVisible();
    await expect(page.locator('#foms-by-district apx-chart')).toBeVisible();
    await expect(page.locator('#comments-by-district apx-chart')).toBeVisible();
    await expect(page.locator('#foms-by-forest-client apx-chart')).toBeVisible();
  });
});
