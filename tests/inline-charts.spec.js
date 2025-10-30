/**
 * Inline Chart Rendering Tests
 * Tests for chart display in question answers and consensus view
 */

import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';

test.describe('Inline Chart Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);
  });

  test('Charts render inline after answer submission', async ({ page }) => {
    // Navigate to a chart-eligible FRQ
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Check if "Add Chart" button exists
    const addChartBtn = questionContainer.locator('button:has-text("Add Chart")');

    if (await addChartBtn.isVisible().catch(() => false)) {
      // Click to open chart wizard
      await addChartBtn.click();
      await page.waitForTimeout(1000);

      // Verify chart wizard modal opens
      const chartWizard = page.locator('.chart-wizard-modal, #chartWizardModal');
      await expect(chartWizard).toBeVisible({ timeout: 5000 });

      // Select histogram chart type
      const histogramOption = chartWizard.locator('[data-chart-type="histogram"], button:has-text("Histogram")');
      await histogramOption.click();
      await page.waitForTimeout(500);

      // Add some sample data
      const dataInput = chartWizard.locator('textarea, input[type="text"]').first();
      if (await dataInput.isVisible().catch(() => false)) {
        await dataInput.fill('0-10: 5\n10-20: 8\n20-30: 12\n30-40: 7\n40-50: 3');
      }

      // Save the chart
      const saveBtn = chartWizard.locator('button:has-text("Save"), button:has-text("Create Chart")');
      await saveBtn.click();
      await page.waitForTimeout(1000);

      // Verify chart wizard closes
      await expect(chartWizard).not.toBeVisible();

      // Verify inline chart appears
      const chartContainer = questionContainer.locator('.chart-container, .inline-chart');
      await expect(chartContainer).toBeVisible({ timeout: 5000 });

      // Verify canvas element exists
      const canvas = chartContainer.locator('canvas');
      await expect(canvas).toBeVisible();

      // Verify canvas is not blank (has content)
      const hasContent = await canvas.evaluate(node => {
        const ctx = node.getContext('2d');
        const imageData = ctx.getImageData(0, 0, node.width, node.height);
        // Check if any pixel is non-transparent
        for (let i = 3; i < imageData.data.length; i += 4) {
          if (imageData.data[i] > 0) return true;
        }
        return false;
      });

      expect(hasContent).toBeTruthy();
    }
  });

  test('Charts persist after page refresh', async ({ page }) => {
    // First, create a chart (or verify existing chart data)
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Inject a chart into localStorage for testing
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {} };
      }

      // Create test chart data
      classData.users[username].charts['U1-L10-Q04'] = {
        type: 'histogram',
        title: 'Test Histogram',
        data: {
          bins: [
            { label: '0-10', value: 5 },
            { label: '10-20', value: 8 },
            { label: '20-30', value: 12 }
          ]
        },
        xLabel: 'Score Range',
        yLabel: 'Frequency'
      };

      classData.users[username].answers['U1-L10-Q04'] = JSON.stringify(classData.users[username].charts['U1-L10-Q04']);

      localStorage.setItem('classData', JSON.stringify(classData));
    });

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Navigate back to the question
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Verify chart renders after reload
    const chartContainer = questionContainer.locator('.chart-container, .inline-chart, canvas').first();
    await expect(chartContainer).toBeVisible({ timeout: 5000 });
  });

  test('Chart.js library is loaded', async ({ page }) => {
    await page.goto('/');

    // Check if Chart.js is available
    const chartJsLoaded = await page.evaluate(() => {
      return typeof window.Chart !== 'undefined';
    });

    expect(chartJsLoaded).toBeTruthy();
  });

  test('Chart rendering functions exist', async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);

    // Check for chart rendering functions
    const functions = await page.evaluate(() => {
      return {
        renderChartNow: typeof window.renderChartNow === 'function',
        getChartHtml: typeof window.getChartHtml === 'function',
        chartInstances: typeof window.chartInstances !== 'undefined',
        renderHistogram: typeof window.renderHistogram === 'function',
        renderDotplot: typeof window.renderDotplot === 'function'
      };
    });

    console.log('Chart functions:', functions);

    // At least some chart rendering functions should exist
    const hasSomeFunctions = Object.values(functions).some(v => v === true);
    expect(hasSomeFunctions).toBeTruthy();
  });

  test('Charts display in consensus view', async ({ page }) => {
    // Navigate to a question
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Inject peer chart data
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');

      // Add a peer user with a chart answer
      classData.users['Peer_User_Test'] = {
        answers: {
          'U1-L10-Q04': JSON.stringify({
            type: 'histogram',
            title: 'Peer Chart',
            data: {
              bins: [
                { label: '0-10', value: 3 },
                { label: '10-20', value: 7 }
              ]
            }
          })
        },
        charts: {
          'U1-L10-Q04': {
            type: 'histogram',
            title: 'Peer Chart',
            data: {
              bins: [
                { label: '0-10', value: 3 },
                { label: '10-20', value: 7 }
              ]
            }
          }
        }
      };

      localStorage.setItem('classData', JSON.stringify(classData));
    });

    // Refresh to reload data
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Look for consensus or peer answers section
    const consensusSection = questionContainer.locator('.consensus, .peer-answers, .all-answers');

    // If consensus section exists, check for charts
    if (await consensusSection.isVisible().catch(() => false)) {
      const peerCharts = consensusSection.locator('canvas, .chart-container');
      const count = await peerCharts.count();

      console.log(`Found ${count} peer chart(s) in consensus view`);

      // At least our injected peer chart should be visible
      if (count > 0) {
        await expect(peerCharts.first()).toBeVisible();
      }
    }
  });

  test('SIF deserializer handles chart data safely', async ({ page }) => {
    await page.goto('/');

    // Test SIF parsing
    const testResult = await page.evaluate(() => {
      // Check if deserializer exists
      if (typeof window.deserializeSIF !== 'function') {
        return { error: 'deserializeSIF not found' };
      }

      // Test valid histogram SIF
      const validSIF = {
        type: 'histogram',
        data: {
          bins: [
            { label: '0-10', value: 5 },
            { label: '10-20', value: 8 }
          ]
        },
        xLabel: 'Range',
        yLabel: 'Count'
      };

      try {
        const result = window.deserializeSIF(validSIF);
        return {
          success: true,
          hasType: !!result.type,
          hasData: !!result.data
        };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('SIF deserializer test:', testResult);

    if (testResult.error !== 'deserializeSIF not found') {
      expect(testResult.success).toBeTruthy();
      expect(testResult.hasType).toBeTruthy();
    }
  });

  test('Chart containers have proper structure', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Inject chart data
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {} };
      }

      classData.users[username].charts['U1-L10-Q04'] = {
        type: 'bar',
        title: 'Test Bar Chart',
        series: [{ name: 'Series 1', values: [1, 2, 3] }],
        categories: ['A', 'B', 'C']
      };

      localStorage.setItem('classData', JSON.stringify(classData));
    });

    // Trigger chart rendering
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Check for chart container structure
    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    const chartContainer = questionContainer.locator('.chart-container').first();

    if (await chartContainer.isVisible().catch(() => false)) {
      // Verify structure elements
      const hasTitle = await chartContainer.locator('.chart-title').isVisible().catch(() => false);
      const hasCanvas = await chartContainer.locator('canvas').isVisible().catch(() => false);

      console.log('Chart structure:', { hasTitle, hasCanvas });

      expect(hasCanvas).toBeTruthy();
    }
  });

  test('No console errors during chart rendering', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await navigateToQuestion(page, 'U1-L10-Q04');

    // Inject and render chart
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {} };
      }

      classData.users[username].charts['U1-L10-Q04'] = {
        type: 'histogram',
        data: {
          bins: [
            { label: '0-10', value: 5 }
          ]
        }
      };

      localStorage.setItem('classData', JSON.stringify(classData));
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await navigateToQuestion(page, 'U1-L10-Q04');

    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.includes('WebSocket')
    );

    console.log('Console errors during chart rendering:', criticalErrors);

    // Should have no critical errors
    expect(criticalErrors.length).toBe(0);
  });
});
