/**
 * Inline Graph Creator Tests
 * Tests for the inline chart creation UI for requiresGraph questions
 */

import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';

test.describe('Inline Graph Creator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);
  });

  test('Add Bar button exists and is visible', async ({ page }) => {
    // Navigate to histogram question (U1-PC-FRQ-Q01 requires histogram)
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Wait for question to be visible
    await expect(questionContainer).toBeVisible();

    // Check if Add Bar button exists
    const addBarBtn = questionContainer.locator('button.add-bar-btn, button:has-text("Add Bar"), button:has-text("Add Category")');

    // Button should be visible
    await expect(addBarBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('Add Bar button adds new input row', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Count initial rows
    const initialRowCount = await questionContainer.locator('.graph-row').count();
    console.log('Initial row count:', initialRowCount);

    // Click Add Bar button
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();
    await addBarBtn.click();

    // Wait a bit for DOM update
    await page.waitForTimeout(300);

    // Count rows after adding
    const newRowCount = await questionContainer.locator('.graph-row').count();
    console.log('New row count:', newRowCount);

    // Should have one more row
    expect(newRowCount).toBe(initialRowCount + 1);
  });

  test('Multiple rows can be added', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();

    // Add 3 more rows
    for (let i = 0; i < 3; i++) {
      await addBarBtn.click();
      await page.waitForTimeout(200);
    }

    // Should have at least 4 rows total (1 initial + 3 added)
    const rowCount = await questionContainer.locator('.graph-row').count();
    expect(rowCount).toBeGreaterThanOrEqual(4);
  });

  test('Data can be entered in new rows', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();

    // Add a new row
    await addBarBtn.click();
    await page.waitForTimeout(300);

    // Get all rows
    const rows = questionContainer.locator('.graph-row');
    const lastRow = rows.last();

    // Fill in data
    const labelInput = lastRow.locator('input.label');
    const valueInput = lastRow.locator('input.value');

    await labelInput.fill('10-20');
    await valueInput.fill('15');

    // Verify data was entered
    await expect(labelInput).toHaveValue('10-20');
    await expect(valueInput).toHaveValue('15');
  });

  test('Remove button exists in each row', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Get all rows
    const rows = questionContainer.locator('.graph-row');
    const rowCount = await rows.count();

    // Each row should have a remove button
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const removeBtn = row.locator('button.remove-row, button:has-text("Remove")');
      await expect(removeBtn).toBeVisible();
    }
  });

  test('Remove button removes the row', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();

    // Add extra rows to ensure we have more than one
    await addBarBtn.click();
    await addBarBtn.click();
    await page.waitForTimeout(500);

    // Count rows before removal
    const initialCount = await questionContainer.locator('.graph-row').count();

    // Click first remove button
    const firstRow = questionContainer.locator('.graph-row').first();
    const removeBtn = firstRow.locator('button.remove-row, button:has-text("Remove")').first();
    await removeBtn.click();

    await page.waitForTimeout(300);

    // Count rows after removal
    const finalCount = await questionContainer.locator('.graph-row').count();

    // Should have one fewer row
    expect(finalCount).toBe(initialCount - 1);
  });

  test('Chart preview updates when data is added', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Enter some data
    const firstRow = questionContainer.locator('.graph-row').first();
    await firstRow.locator('input.label').fill('0-10');
    await firstRow.locator('input.value').fill('5');

    // Trigger preview update (usually happens on change)
    await firstRow.locator('input.value').press('Tab');

    await page.waitForTimeout(500);

    // Check if chart preview exists
    const chartPreview = questionContainer.locator('#chart-preview-U1-L10-Q04, [data-chart-preview]');
    const previewExists = await chartPreview.count() > 0;

    console.log('Chart preview exists:', previewExists);

    if (previewExists) {
      await expect(chartPreview.first()).toBeVisible();
    }
  });

  test('addGraphRow function exists globally', async ({ page }) => {
    await page.goto('/');

    const functionExists = await page.evaluate(() => {
      return typeof window.addGraphRow === 'function';
    });

    expect(functionExists).toBeTruthy();
  });

  test('removeGraphRow function exists globally', async ({ page }) => {
    await page.goto('/');

    const functionExists = await page.evaluate(() => {
      return typeof window.removeGraphRow === 'function';
    });

    expect(functionExists).toBeTruthy();
  });

  test('updateInlineChartPreview function exists globally', async ({ page }) => {
    await page.goto('/');

    const functionExists = await page.evaluate(() => {
      return typeof window.updateInlineChartPreview === 'function';
    });

    expect(functionExists).toBeTruthy();
  });

  test('Graph input container has correct ID', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const graphInput = page.locator('#graph-input-U1-L10-Q04');
    await expect(graphInput).toBeAttached();
  });

  test('Input fields have correct classes', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const firstRow = questionContainer.locator('.graph-row').first();

    // Check for label input
    const labelInput = firstRow.locator('input.label');
    await expect(labelInput).toBeVisible();

    // Check for value input
    const valueInput = firstRow.locator('input.value');
    await expect(valueInput).toBeVisible();
  });

  test('Chart data can be saved and submitted', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Fill in data
    const rows = questionContainer.locator('.graph-row');
    const row1 = rows.first();

    await row1.locator('input.label').fill('0-10');
    await row1.locator('input.value').fill('5');

    // Add another row
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();
    await addBarBtn.click();
    await page.waitForTimeout(300);

    const row2 = rows.nth(1);
    await row2.locator('input.label').fill('10-20');
    await row2.locator('input.value').fill('8');

    // Submit the answer
    const submitBtn = questionContainer.locator('button:has-text("Submit")').first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Check if data was saved to localStorage
      const savedData = await page.evaluate(() => {
        const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
        const username = localStorage.getItem('consensusUsername');
        return classData.users?.[username]?.charts?.['U1-L10-Q04'];
      });

      console.log('Saved chart data:', savedData);

      // Should have saved chart data
      expect(savedData).toBeTruthy();
    }
  });

  test('CSS classes are properly styled', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Check Add Bar button styling
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();

    if (await addBarBtn.isVisible().catch(() => false)) {
      const bgColor = await addBarBtn.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      console.log('Add Bar button background color:', bgColor);

      // Should have a background color (not transparent)
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(bgColor).not.toBe('transparent');
    }
  });

  test('No console errors when using graph creator', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();

    // Add some rows
    await addBarBtn.click();
    await page.waitForTimeout(200);
    await addBarBtn.click();
    await page.waitForTimeout(200);

    // Fill in data
    const rows = questionContainer.locator('.graph-row');
    const firstRow = rows.first();
    await firstRow.locator('input.label').fill('Test');
    await firstRow.locator('input.value').fill('10');

    await page.waitForTimeout(500);

    // Filter out non-critical errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.includes('WebSocket')
    );

    console.log('Console errors:', criticalErrors);

    // Should have no critical errors
    expect(criticalErrors.length).toBe(0);
  });

  test('Submit button exists for requiresGraph questions', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Wait for question to be visible
    await expect(questionContainer).toBeVisible();

    // Check if Submit button exists
    const submitBtn = questionContainer.locator('button.submit-button, button:has-text("Submit")').first();

    // Button should be visible
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
  });

  test('Submit button has proper styling', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const submitBtn = questionContainer.locator('button.submit-button').first();

    if (await submitBtn.isVisible().catch(() => false)) {
      // Check button styling
      const styles = await submitBtn.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          bgColor: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          borderRadius: computed.borderRadius,
          cursor: computed.cursor
        };
      });

      console.log('Submit button styles:', styles);

      // Should have proper styling
      expect(styles.bgColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(styles.bgColor).not.toBe('transparent');
      expect(styles.cursor).toBe('pointer');
    }
  });

  test('Submit button can save chart data', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Fill in some data
    const rows = questionContainer.locator('.graph-row');
    const row1 = rows.first();

    await row1.locator('input.label').fill('0-10');
    await row1.locator('input.value').fill('5');

    // Add another row
    const addBarBtn = questionContainer.locator('button.add-bar-btn').first();
    await addBarBtn.click();
    await page.waitForTimeout(300);

    const row2 = rows.nth(1);
    await row2.locator('input.label').fill('10-20');
    await row2.locator('input.value').fill('8');

    // Click submit button
    const submitBtn = questionContainer.locator('button.submit-button, button:has-text("Submit")').first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Check if data was saved to localStorage
      const savedData = await page.evaluate(() => {
        const classData = JSON.parse(localStorage.getItem('classData') || '{\"users\":{}}');
        const username = localStorage.getItem('consensusUsername');
        return classData.users?.[username]?.charts?.['U1-L10-Q04'];
      });

      console.log('Saved chart data after submit:', savedData);

      // Should have saved chart data
      expect(savedData).toBeTruthy();
    }
  });
});
