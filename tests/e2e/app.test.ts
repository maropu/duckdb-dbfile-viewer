import { test, expect, Page } from '@playwright/test';

test.describe('DuckDB Visualizer Tests', () => {
  /**
   * Helper function to mock a file upload with specified content
   */
  async function mockFileUpload(page: Page, createFileFn: () => any): Promise<void> {
    // Navigate to the homepage
    await page.goto('/');

    // Listen for console events (to capture errors)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`PAGE ERROR: ${msg.text()}`);
      }
    });

    // Call the provided setup function to create the mock file and setup the input
    await page.evaluate(({ createFileFnString }) => {
      // Define helper function in this context
      function setupFileInput(file: File) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

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
      }

      // Execute the file creation function
      const createFileFn = new Function('return ' + createFileFnString)();
      const file = createFileFn();
      setupFileInput(file);
    }, { createFileFnString: createFileFn.toString() });

    // Wait for error message to appear
    await page.waitForTimeout(500);
  }

  /**
   * Verifies that an error message containing the specified text is displayed
   */
  async function expectErrorMessage(page: Page, errorText: string): Promise<void> {
    const errorElement = page.locator('.bg-red-100.text-red-700');
    await expect(errorElement).toBeVisible();
    await expect(errorElement).toContainText(errorText);
  }

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

  test('displays error message when uploading file that is too small', async ({ page }) => {
    await mockFileUpload(page, () => {
      // Create a small file
      return new File(['invalid data'], 'test.db', { type: 'application/octet-stream' });
    });

    await expectErrorMessage(page, 'File size is too small');
  });

  test('displays error message when uploading file with invalid magic bytes', async ({ page }) => {
    await mockFileUpload(page, () => {
      // Create an ArrayBuffer of sufficient size
      const buffer = new ArrayBuffer(4096 * 3);  // Three header blocks
      const view = new DataView(buffer);

      // Set first 8 bytes to a checksum value
      view.setBigUint64(0, BigInt(12345), true);

      // Set next 4 bytes to 'FAKE' instead of 'DUCK'
      const textEncoder = new TextEncoder();
      const fakeBytes = textEncoder.encode('FAKE');
      new Uint8Array(buffer, 8, 4).set(fakeBytes);

      // Convert to a Blob/File
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      return new File([blob], 'fake.db', { type: 'application/octet-stream' });
    });

    await expectErrorMessage(page, 'Invalid DuckDB file format');
  });

  test('displays error message when uploading file with unsupported version', async ({ page }) => {
    await mockFileUpload(page, () => {
      // Create an ArrayBuffer of sufficient size
      const buffer = new ArrayBuffer(4096 * 3);  // Three header blocks
      const view = new DataView(buffer);

      // Set first 8 bytes to a checksum value
      view.setBigUint64(0, BigInt(12345), true);

      // Set next 4 bytes to 'DUCK'
      const textEncoder = new TextEncoder();
      const magicBytes = textEncoder.encode('DUCK');
      new Uint8Array(buffer, 8, 4).set(magicBytes);

      // Set version number (bytes 12-20) to a value
      view.setBigUint64(12, BigInt(1), true);  // Version 1

      // Set library version string at byte 52 to 'v1.1.0' (unsupported)
      const versionBytes = textEncoder.encode('v1.1.0');
      new Uint8Array(buffer, 52, versionBytes.length).set(versionBytes);

      // Convert to a Blob/File
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      return new File([blob], 'old_version.db', { type: 'application/octet-stream' });
    });

    await expectErrorMessage(page, 'Unsupported DuckDB version');
  });
});