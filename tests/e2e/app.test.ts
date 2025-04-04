import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('DuckDB Visualizer Tests', () => {
  /**
   * Helper function to get the path to a test database file in the fixtures directory
   * @param fileName The name of the database file in the fixtures directory
   * @returns The absolute path to the database file
   * @throws Error if the file does not exist
   */
  function getTestDbPath(fileName: string): string {
    const dbPath = path.resolve(__dirname, '../fixtures', fileName);

    // Verify the file exists before returning the path
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Test database file not found at ${dbPath}`);
    }

    console.log(`Using test DB at path: ${dbPath}`);
    return dbPath;
  }

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

    // Wait for processing to complete
    await page.waitForTimeout(1500);
  }

  /**
   * Helper function to upload a real test database file
   * @param page The Playwright page object
   * @param fileName The name of the database file in the fixtures directory
   */
  async function uploadTestDatabase(page: Page, fileName: string): Promise<void> {
    // Navigate to the homepage
    await page.goto('/');

    // Get the path to the test database file
    const testDbPath = getTestDbPath(fileName);

    // Upload the file
    await page.setInputFiles('input[type="file"]', testDbPath);
  }

  /**
   * A wrapper function to test file uploads with specific error cases
   * This handles WebKit skipping and common test patterns
   */
  const testFileUploadError = (testName: string, createFileFn: () => any, expectedError: string) => {
    test(testName, async ({ page, browserName }) => {
      // Skip on WebKit as it has issues with the file upload simulation
      test.skip(browserName === 'webkit', 'This test is currently unstable in WebKit');

      await mockFileUpload(page, createFileFn);
      await expectErrorMessage(page, expectedError);
    });
  };

  /**
   * Verifies that an error message containing the specified text is displayed
   */
  async function expectErrorMessage(page: Page, errorText: string): Promise<void> {
    console.log(`Waiting for error message containing: "${errorText}"`);

    // Wait extra time for error message to appear
    await page.waitForTimeout(2000);

    // Use a more general selector for error messages
    const errorElement = page.locator('div[class*="bg-red"]');

    // Check if the element is visible with longer timeout
    await expect(errorElement).toBeVisible({ timeout: 15000 });
    console.log('Error element is visible');

    // Check the text content
    await expect(errorElement).toContainText(errorText);
    console.log(`Error message contains "${errorText}"`);
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

  test('homepage displays the DuckDB logo', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Verify the logo is visible
    const logo = page.locator('img[alt="DuckDB DB File Viewer Logo"]');
    await expect(logo).toBeVisible();

    // Verify the logo source contains the expected image path
    // Using contains instead of exact match because Next.js modifies the src for optimization
    const logoSrc = await logo.getAttribute('src');
    expect(logoSrc).toContain('duckdb-dbfile-viewer-logo.png');

    // Verify the logo is rendered with appropriate CSS class
    await expect(logo).toHaveClass(/mr-[0-9]+/);
  });

  // Use the helper function for each error test case
  testFileUploadError(
    'displays error message when uploading file that is too small',
    () => {
      // Create a small file
      return new File(['invalid data'], 'test.db', { type: 'application/octet-stream' });
    },
    'File size is too small'
  );

  testFileUploadError(
    'displays error message when uploading file with invalid magic bytes',
    () => {
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
    },
    'Invalid DuckDB file format'
  );

  testFileUploadError(
    'displays error message when uploading file with unsupported version',
    () => {
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
    },
    'Unsupported DuckDB version'
  );

  // Test for file size exceeding the maximum limit
  testFileUploadError(
    'displays error message when uploading file exceeding the maximum size limit',
    () => {
      // Create a mock file that reports a size larger than 512MB
      // Note: We don't actually create a 512MB+ file for testing efficiency
      // Instead, we override the size property of the File object
      const smallBuffer = new ArrayBuffer(4096 * 3);  // Small buffer for actual content
      const view = new DataView(smallBuffer);

      // Set first 8 bytes to a checksum value
      view.setBigUint64(0, BigInt(12345), true);

      // Set next 4 bytes to 'DUCK'
      const textEncoder = new TextEncoder();
      const magicBytes = textEncoder.encode('DUCK');
      new Uint8Array(smallBuffer, 8, 4).set(magicBytes);

      // Create a file with the small buffer
      const file = new File([smallBuffer], 'too_large.db', { type: 'application/octet-stream' });

      // Override the size property to simulate a large file
      // 513MB in bytes
      Object.defineProperty(file, 'size', {
        value: 513 * 1024 * 1024,
        writable: false
      });

      return file;
    },
    'File size exceeds the maximum limit of 512MB'
  );

  test('blocks are rendered as squares with real file upload', async ({ page, browserName }) => {
    // Test only in Chromium for now to reduce flakiness
    test.skip(browserName !== 'chromium', 'This test is currently only stable in Chromium');

    // Use the helper function to upload the test database
    await uploadTestDatabase(page, 'testdb_t5_r200_1.2.1.db');

    // Wait for the visualization to render - we're targeting the actual content
    // that would appear after successful file processing
    await page.waitForSelector('h3:has-text("File Blocks")', { timeout: 15000 });
    console.log('Block visualization section found');

    // Wait for blocks to appear in the grid
    await page.waitForSelector('.aspect-square', { timeout: 15000 });
    console.log('Aspect-square blocks found');

    // Find all aspect-square elements (these are the block containers)
    const blocks = page.locator('.aspect-square');

    // Ensure blocks exist
    const count = await blocks.count();
    console.log(`Found ${count} blocks`);
    expect(count).toBeGreaterThan(0);

    // Test first block dimensions to verify it's square
    const firstBlock = blocks.first();

    // Wait for the block to be fully rendered
    await firstBlock.waitFor({ state: 'visible', timeout: 5000 });

    // Get the bounding box of the element
    const boundingBox = await firstBlock.boundingBox();

    // Check if the element exists and has dimensions
    expect(boundingBox).not.toBeNull();

    if (boundingBox) {
      console.log(`Block dimensions: ${boundingBox.width}x${boundingBox.height}`);
      // Check that width and height are approximately equal (allow for 1px difference due to browser rendering)
      expect(Math.abs(boundingBox.width - boundingBox.height)).toBeLessThanOrEqual(1);

      // Ensure the element has reasonable dimensions (not collapsed)
      expect(boundingBox.width).toBeGreaterThan(10);
      expect(boundingBox.height).toBeGreaterThan(10);
    }
  });
});
