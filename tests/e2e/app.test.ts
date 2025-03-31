import { test, expect } from '@playwright/test';

test.describe('DuckDB Visualizer Tests', () => {
  test('homepage has the right title', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Verify the page title is correct
    const title = page.locator('h1');
    await expect(title).toContainText('DuckDB Database File Viewer');

    // Verify file upload section exists
    const fileUploadLabel = page.locator('label', { hasText: 'Select a DuckDB database file:' });
    await expect(fileUploadLabel).toBeVisible();

    // Verify file input field exists
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });

  test('displays error message when uploading invalid file', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Listen for console events (to capture errors)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`PAGE ERROR: ${msg.text()}`);
      }
    });

    // Use eval to mock File object
    await page.evaluate(() => {
      // Mock File API
      const invalidFile = new File(['invalid data'], 'test.db', { type: 'application/octet-stream' });

      // Mock FileList
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(invalidFile);

      // Get input element and set file
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
          value: dataTransfer.files,
          writable: false
        });

        // Trigger change event
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Wait a bit for error message to appear
    await page.waitForTimeout(500);

    // Look for error message element
    const errorElement = page.locator('.bg-red-100.text-red-700');
    await expect(errorElement).toBeVisible();
    await expect(errorElement).toContainText('File size is too small');
  });
});