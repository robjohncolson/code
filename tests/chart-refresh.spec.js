import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';
import { createHistogramChart, isChartDisplayed, getChartButtonText } from './helpers/chart-wizard.js';
import { isChartSaved } from './helpers/storage-validator.js';
import testData from './fixtures/chart-data.json' assert { type: 'json' };

test.describe('Chart Refresh Test', () => {
  const TEST_QUESTION = 'U1-L10-Q04';

  test('chart persists and displays after page refresh', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('chart') || text.includes('Chart') || text.includes('Rendering saved chart')) {
        console.log(`📋 Browser: ${text}`);
      }
    });

    await page.goto('/');
    const username = await loginAndSetup(page);
    console.log(`\n✅ Logged in as: ${username}\n`);

    // Navigate to question and create chart
    await navigateToQuestion(page, TEST_QUESTION);
    console.log('Step 1: Creating chart...');
    await createHistogramChart(page, TEST_QUESTION, testData.simple_histogram);

    // Verify chart saved
    const savedBefore = await isChartSaved(page, username, TEST_QUESTION);
    console.log(`Chart saved before refresh: ${savedBefore ? '✅' : '❌'}`);
    expect(savedBefore).toBe(true);

    // Check if displayed immediately after creation
    const displayedBefore = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed before refresh: ${displayedBefore ? '✅' : '❌'}`);

    // REFRESH PAGE
    console.log('\n🔄 REFRESHING PAGE...\n');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Wait for full initialization

    // Verify still logged in
    const currentUsername = await page.evaluate(() => localStorage.getItem('consensusUsername'));
    console.log(`Still logged in as: ${currentUsername}`);
    expect(currentUsername).toBe(username);

    // Check if chart still in localStorage
    const savedAfter = await isChartSaved(page, username, TEST_QUESTION);
    console.log(`Chart in localStorage after refresh: ${savedAfter ? '✅' : '❌'}`);
    expect(savedAfter).toBe(true);

    // Navigate back to the question
    console.log('\nNavigating back to question...');
    await navigateToQuestion(page, TEST_QUESTION);

    // Give plenty of time for rendering
    console.log('Waiting for chart to render...');
    await page.waitForTimeout(3000);

    // Check classData
    const classDataInfo = await page.evaluate(({ uname, qid }) => {
      return {
        hasClassData: !!window.classData,
        hasUser: !!window.classData?.users?.[uname],
        hasChart: !!window.classData?.users?.[uname]?.charts?.[qid],
        currentUsername: window.currentUsername,
        renderFnExists: typeof window.renderChartWizardPreview === 'function',
      };
    }, { uname: username, qid: TEST_QUESTION });
    console.log('ClassData info:', classDataInfo);

    // Try manual render
    await page.evaluate((qid) => {
      console.log(`Attempting manual render of ${qid}...`);
      if (typeof window.renderChartWizardPreview === 'function') {
        window.renderChartWizardPreview(qid);
      }
    }, TEST_QUESTION);

    await page.waitForTimeout(1000);

    // Check if chart is displayed
    const displayedAfter = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed after refresh: ${displayedAfter ? '✅' : '❌'}`);

    // Get button text
    const buttonText = await getChartButtonText(page, TEST_QUESTION);
    console.log(`Button text: "${buttonText}"`);

    // Screenshot for debugging
    await page.screenshot({ path: 'test-results/refresh-test.png', fullPage: true });

    expect(displayedAfter, 'Chart should be displayed after page refresh').toBe(true);
    expect(buttonText).toContain('Edit');
  });
});
