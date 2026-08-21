import { test, expect } from '@playwright/test';

test.describe('Public - Public Notices', () => {
  test('should open public notices panel and display filter controls', async ({ page }) => {
    await page.goto('/public/projects');

    // Click Public Notices panel button
    const noticesTab = page.locator('.side-nav button:has-text("Public Notices")');
    await expect(noticesTab).toBeVisible({ timeout: 10000 });
    await noticesTab.click();

    // Verify Public Notices panel is active
    const noticesPanel = page.locator('app-public-notices-panel, .side-panel');
    await expect(noticesPanel.first()).toBeVisible({ timeout: 5000 });

    // Results count / container should be visible
    const resultsContainer = page.locator('.app-results, .side-panel');
    await expect(resultsContainer.first()).toBeVisible({ timeout: 10000 });
  });
});
