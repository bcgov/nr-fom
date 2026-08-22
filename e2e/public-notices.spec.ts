import { test, expect } from '@playwright/test';

test.describe('Public - Public Notices', () => {
  test('should open public notices panel and display filter controls', async ({ page }) => {
    await page.goto('/public/projects');

    // Click Public Notices panel button
    const noticesTab = page.locator('.side-nav button:has-text("Public Notices")');
    await expect(noticesTab).toBeVisible({ timeout: 10000 });
    await noticesTab.click();

    // Verify Public Notices panel is active and side panel is open
    const noticesPanel = page.locator('app-public-notices-panel');
    await expect(page.locator('.applications-view')).toHaveClass(/side-panel__open/);
    await expect(noticesPanel).not.toHaveAttribute('hidden', '');

    // Expand filter panel if accordion header is present
    const filterHeader = noticesPanel.getByText('Public Notice Filter', { exact: true });
    if (await filterHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterHeader.click();
    }

    // Verify filter inputs are present
    await expect(noticesPanel.locator('#pnForestClientNameInput')).toBeAttached();
    await expect(noticesPanel.locator('#postedAsOfInput')).toBeAttached();
    await expect(noticesPanel.locator('#districtInput')).toBeAttached();
  });
});
