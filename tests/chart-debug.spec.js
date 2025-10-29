import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';
import { createHistogramChart, isChartDisplayed } from './helpers/chart-wizard.js';
import { isChartSaved, getChartData } from './helpers/storage-validator.js';
import testData from './fixtures/chart-data.json' assert { type: 'json' };

test.describe('Chart Debug', () => {
  const TEST_QUESTION = 'U1-L10-Q04';

  test('debug chart creation and display', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`Browser: ${msg.text()}`));

    await page.goto('/');
    const username = await loginAndSetup(page);
    console.log(`Logged in as: ${username}`);

    // Navigate to question
    await navigateToQuestion(page, TEST_QUESTION);
    console.log('Navigated to question');

    // Create chart
    console.log('Creating chart...');
    await createHistogramChart(page, TEST_QUESTION, testData.simple_histogram);
    console.log('Chart creation complete');

    // Wait for any post-save operations
    await page.waitForTimeout(2000);

    // Check if chart is saved in localStorage
    const saved = await isChartSaved(page, username, TEST_QUESTION);
    console.log(`Chart saved in localStorage: ${saved}`);

    // Get the actual chart data
    const chartData = await getChartData(page, username, TEST_QUESTION);
    console.log('Chart data:', JSON.stringify(chartData, null, 2));

    // Check window.charts availability
    const chartsAvailable = await page.evaluate(() => {
      return {
        charts: !!window.charts,
        getChartHtml: typeof window.charts?.getChartHtml === 'function',
        renderChartNow: typeof window.charts?.renderChartNow === 'function',
        renderChartWizardPreview: typeof window.renderChartWizardPreview === 'function',
      };
    });
    console.log('Charts functions:', chartsAvailable);

    // Try to manually call renderChartWizardPreview
    await page.evaluate((qid) => {
      console.log(`Manually calling renderChartWizardPreview(${qid})`);
      if (typeof window.renderChartWizardPreview === 'function') {
        window.renderChartWizardPreview(qid);
      }
    }, TEST_QUESTION);

    await page.waitForTimeout(1000);

    // Check if preview container exists
    const containerInfo = await page.evaluate((qid) => {
      const container = document.getElementById(`chart-preview-${qid}`);
      return {
        exists: !!container,
        innerHTML: container?.innerHTML?.substring(0, 500),
        classList: container ? Array.from(container.classList) : [],
      };
    }, TEST_QUESTION);
    console.log('Container info:', containerInfo);

    // Check if chart is displayed
    const displayed = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed: ${displayed}`);

    // Take screenshot
    await page.screenshot({ path: 'test-results/chart-debug.png', fullPage: true });

    expect(saved).toBe(true);
    expect(displayed).toBe(true);
  });
});
