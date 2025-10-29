import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion, navigateBackToUnits } from './helpers/navigation.js';
import {
  createHistogramChart,
  isChartDisplayed,
  getChartButtonText,
  openChartWizard,
  saveChart,
  enterHistogramData,
  enterChartMetadata,
} from './helpers/chart-wizard.js';
import {
  isChartSaved,
  getChartData,
  validateChartStructure,
  getChartWizardStatus,
  isSaveFunctionAvailable,
  captureStorageSnapshot,
  getAllCharts,
} from './helpers/storage-validator.js';
import testData from './fixtures/chart-data.json' assert { type: 'json' };

test.describe('Chart Persistence Tests', () => {
  const TEST_QUESTION = 'U1-L10-Q04';
  let username;

  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Browser Error: ${msg.text()}`);
      } else if (msg.text().includes('chart') || msg.text().includes('Chart')) {
        console.log(`📋 Browser Log: ${msg.text()}`);
      }
    });

    // Catch page errors
    page.on('pageerror', error => {
      console.error(`❌ Page Error: ${error.message}`);
    });

    // Navigate to the app
    await page.goto('/');

    // Login/setup
    username = await loginAndSetup(page);
    console.log(`Test running as: ${username}`);
  });

  test('should have required functions available', async ({ page }) => {
    console.log('\n🧪 Test: Checking required functions...\n');

    const status = await getChartWizardStatus(page);

    console.log('Function availability:');
    console.log(`  - openChartWizard: ${status.openChartWizard ? '✅' : '❌'}`);
    console.log(`  - renderChartWizardPreview: ${status.renderChartWizardPreview ? '✅' : '❌'}`);
    console.log(`  - saveClassData: ${status.saveClassData ? '✅' : '❌'}`);
    console.log(`  - charts module: ${status.chartsModule ? '✅' : '❌'}`);
    console.log(`  - renderChartNow: ${status.renderChartNow ? '✅' : '❌'}`);

    expect(status.saveClassData, 'saveClassData should be available').toBe(true);
    expect(status.openChartWizard, 'openChartWizard should be available').toBe(true);
    expect(status.renderChartWizardPreview, 'renderChartWizardPreview should be available').toBe(true);
  });

  test('should create and save chart to localStorage', async ({ page }) => {
    console.log('\n🧪 Test: Create and save chart to localStorage...\n');

    // Navigate to test question
    await navigateToQuestion(page, TEST_QUESTION);

    // Debug: Log what's on the page
    const pageContent = await page.locator(`.quiz-container[data-question-id="${TEST_QUESTION}"]`).first().textContent();
    console.log('Question content loaded:', pageContent ? pageContent.substring(0, 200) : 'NOT FOUND');

    // Check if chart button exists
    const chartButtonExists = await page.locator(`button[data-chart-button="${TEST_QUESTION}"]`).count();
    console.log(`Chart button exists: ${chartButtonExists > 0 ? '✅' : '❌'} (count: ${chartButtonExists})`);

    // Take screenshot before opening wizard
    await page.screenshot({ path: 'test-results/before-chart-wizard.png' });

    // Create chart
    await createHistogramChart(page, TEST_QUESTION, testData.simple_histogram);

    // Wait a moment for the save operation to complete
    await page.waitForTimeout(1000);

    // Debug: Check if saveClassData was called
    const debugInfo = await page.evaluate(() => {
      return {
        saveClassDataExists: typeof window.saveClassData === 'function',
        windowClassDataExists: !!window.classData,
        classDataExists: typeof classData !== 'undefined',
        sameObject: window.classData === classData
      };
    });
    console.log(`window.saveClassData exists: ${debugInfo.saveClassDataExists ? '✅' : '❌'}`);
    console.log(`window.classData exists: ${debugInfo.windowClassDataExists ? '✅' : '❌'}`);
    console.log(`classData exists: ${debugInfo.classDataExists ? '✅' : '❌'}`);
    console.log(`window.classData === classData: ${debugInfo.sameObject ? '✅' : '❌'}`);

    // Debug: Check localStorage directly
    const localStorageContent = await page.evaluate(() => {
      return localStorage.getItem('classData');
    });
    console.log(`localStorage.classData exists: ${localStorageContent ? '✅' : '❌'}`);
    if (localStorageContent) {
      const parsed = JSON.parse(localStorageContent);
      console.log(`Users in classData: ${Object.keys(parsed.users || {})}`);

      // Check our specific user's data
      const ourUser = parsed.users[username];
      if (ourUser) {
        console.log(`Our user has answers: ${Object.keys(ourUser.answers || {}).length}`);
        console.log(`Our user has charts: ${Object.keys(ourUser.charts || {}).length}`);
        console.log(`Answer keys: ${Object.keys(ourUser.answers || {})}`);
        console.log(`Chart keys: ${Object.keys(ourUser.charts || {})}`);

        // Check specifically for our question
        if (ourUser.answers && ourUser.answers['U1-L10-Q04']) {
          console.log(`U1-L10-Q04 answer:`, typeof ourUser.answers['U1-L10-Q04'], JSON.stringify(ourUser.answers['U1-L10-Q04']).substring(0, 100));
        }
        if (ourUser.charts && ourUser.charts['U1-L10-Q04']) {
          console.log(`U1-L10-Q04 chart:`, typeof ourUser.charts['U1-L10-Q04']);
        }
      } else {
        console.log(`⚠️ Our user (${username}) not found in classData!`);
      }
    }

    // Verify chart is saved in localStorage
    const saved = await isChartSaved(page, username, TEST_QUESTION);
    console.log(`Chart saved in localStorage: ${saved ? '✅' : '❌'}`);

    expect(saved, 'Chart should be saved in localStorage').toBe(true);

    // Get and validate chart data
    const chartData = await getChartData(page, username, TEST_QUESTION);
    console.log('Chart data retrieved:', JSON.stringify(chartData, null, 2));

    const validation = validateChartStructure(chartData);
    console.log(`Chart structure valid: ${validation.valid ? '✅' : '❌'}`);

    if (!validation.valid) {
      console.log('Validation errors:', validation.errors);
    }

    expect(validation.valid, 'Chart structure should be valid').toBe(true);

    // Verify basic chart properties
    expect(chartData.type).toBe('histogram');
    expect(chartData.binning?.bins).toHaveLength(2);
  });

  test('CRITICAL: chart persists after page refresh', async ({ page }) => {
    console.log('\n🧪 Test: Chart persistence after refresh (CRITICAL)...\n');

    // Navigate to question
    await navigateToQuestion(page, TEST_QUESTION);

    // Create chart
    console.log('Step 1: Creating chart...');
    await createHistogramChart(page, TEST_QUESTION, testData.simple_histogram);

    // Verify chart is saved
    console.log('Step 2: Verifying initial save...');
    let saved = await isChartSaved(page, username, TEST_QUESTION);
    expect(saved, 'Chart should be saved before refresh').toBe(true);

    // Check if chart is displayed
    console.log('Step 3: Checking if chart is displayed before refresh...');
    let displayed = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed before refresh: ${displayed ? '✅' : '❌'}`);

    // Capture storage snapshot before refresh
    const snapshotBefore = await captureStorageSnapshot(page);
    console.log('Storage snapshot before refresh:', {
      username: snapshotBefore.username,
      hasClassData: !!snapshotBefore.classData,
      chartCount: Object.keys(snapshotBefore.classData?.users?.[username]?.charts || {}).length,
    });

    // **CRITICAL STEP: Refresh the page**
    console.log('\n🔄 REFRESHING PAGE...\n');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Give time for scripts to load

    // Verify we're still logged in
    const currentUsername = await page.evaluate(() => {
      return localStorage.getItem('consensusUsername');
    });
    expect(currentUsername).toBe(username);
    console.log(`Still logged in as: ${currentUsername}`);

    // Capture storage snapshot after refresh
    const snapshotAfter = await captureStorageSnapshot(page);
    console.log('Storage snapshot after refresh:', {
      username: snapshotAfter.username,
      hasClassData: !!snapshotAfter.classData,
      chartCount: Object.keys(snapshotAfter.classData?.users?.[username]?.charts || {}).length,
    });

    // Check if chart still exists in localStorage
    console.log('\nStep 4: Checking localStorage after refresh...');
    saved = await isChartSaved(page, username, TEST_QUESTION);
    console.log(`Chart in localStorage after refresh: ${saved ? '✅' : '❌'}`);

    if (!saved) {
      console.error('\n❌ CRITICAL FAILURE: Chart lost from localStorage after refresh!');
      const allCharts = await getAllCharts(page, username);
      console.error('All charts after refresh:', allCharts);
    }

    expect(saved, 'Chart should still be in localStorage after refresh').toBe(true);

    // Navigate back to the question
    console.log('\nStep 5: Navigating back to question...');
    await navigateToQuestion(page, TEST_QUESTION);

    // Wait for charts to render
    await page.waitForTimeout(1500);

    // **CRITICAL: Check if chart is displayed**
    console.log('\nStep 6: Checking if chart is displayed after refresh...');
    displayed = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed after refresh: ${displayed ? '✅' : '❌'}`);

    if (!displayed) {
      console.error('\n❌ CRITICAL FAILURE: Chart not displayed after refresh!');

      // Debug information
      const chartData = await getChartData(page, username, TEST_QUESTION);
      console.error('Chart data from storage:', JSON.stringify(chartData, null, 2));

      const buttonText = await getChartButtonText(page, TEST_QUESTION);
      console.error('Chart button text:', buttonText);

      // Check if preview container exists
      const containerExists = await page.locator(`#chart-preview-${TEST_QUESTION}`).count();
      console.error('Preview container count:', containerExists);

      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/chart-not-displayed.png', fullPage: true });
    }

    expect(displayed, 'Chart should be displayed after refresh').toBe(true);

    // Verify button text changed to "Edit Chart"
    const buttonText = await getChartButtonText(page, TEST_QUESTION);
    console.log(`Chart button text: "${buttonText}"`);
    expect(buttonText).toContain('Edit');
  });

  test('should display chart immediately after creation', async ({ page }) => {
    console.log('\n🧪 Test: Chart displays immediately after creation...\n');

    await navigateToQuestion(page, TEST_QUESTION);

    // Check initial state - no chart
    let displayed = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed before creation: ${displayed ? '⚠️ Unexpected' : '✅ Correct'}`);
    expect(displayed).toBe(false);

    // Create chart
    await createHistogramChart(page, TEST_QUESTION, testData.simple_histogram);

    // Wait a moment for rendering
    await page.waitForTimeout(1000);

    // Chart should now be displayed
    displayed = await isChartDisplayed(page, TEST_QUESTION);
    console.log(`Chart displayed after creation: ${displayed ? '✅' : '❌'}`);

    expect(displayed, 'Chart should be displayed immediately after creation').toBe(true);
  });

  test('should allow editing existing chart', async ({ page }) => {
    console.log('\n🧪 Test: Edit existing chart...\n');

    await navigateToQuestion(page, TEST_QUESTION);

    // Create initial chart
    console.log('Creating initial chart...');
    await createHistogramChart(page, TEST_QUESTION, {
      ...testData.simple_histogram,
      title: 'Original Title',
    });

    // Verify initial save
    let chartData = await getChartData(page, username, TEST_QUESTION);
    expect(chartData.title).toBe('Original Title');

    // Edit the chart
    console.log('Editing chart...');
    await openChartWizard(page, TEST_QUESTION);

    // Change title
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]').first();
    await titleInput.fill('Updated Title');

    await saveChart(page);

    // Verify updated data
    chartData = await getChartData(page, username, TEST_QUESTION);
    console.log('Updated chart title:', chartData.title);

    expect(chartData.title).toBe('Updated Title');
  });

  test('multiple charts can coexist', async ({ page }) => {
    console.log('\n🧪 Test: Multiple charts can coexist...\n');

    // Create chart on first question
    await navigateToQuestion(page, 'U1-L10-Q04');
    await createHistogramChart(page, 'U1-L10-Q04', {
      ...testData.simple_histogram,
      title: 'Chart 1',
    });

    // Navigate back
    await navigateBackToUnits(page);

    // Create chart on another FRQ (if available)
    // For now, just verify first chart persists
    await navigateToQuestion(page, 'U1-L10-Q04');

    const displayed = await isChartDisplayed(page, 'U1-L10-Q04');
    expect(displayed).toBe(true);

    const allCharts = await getAllCharts(page, username);
    const chartCount = Object.keys(allCharts).length;
    console.log(`Total charts saved: ${chartCount}`);

    expect(chartCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Chart Persistence Debugging', () => {
  test('capture full diagnostic info', async ({ page }) => {
    console.log('\n🔍 Diagnostic Test: Capturing full system state...\n');

    await page.goto('/');
    const username = await loginAndSetup(page);

    // Check all functions
    const status = await getChartWizardStatus(page);
    console.log('\n📋 Function Status:');
    Object.entries(status).forEach(([key, val]) => {
      console.log(`  ${key}: ${val ? '✅' : '❌'}`);
    });

    // Capture storage
    const snapshot = await captureStorageSnapshot(page);
    console.log('\n💾 Storage Snapshot:');
    console.log(`  Username: ${snapshot.username}`);
    console.log(`  Has classData: ${!!snapshot.classData}`);

    if (snapshot.classData) {
      const userCount = Object.keys(snapshot.classData.users || {}).length;
      console.log(`  User count: ${userCount}`);

      if (snapshot.classData.users?.[username]) {
        const user = snapshot.classData.users[username];
        console.log(`  Answers: ${Object.keys(user.answers || {}).length}`);
        console.log(`  Charts: ${Object.keys(user.charts || {}).length}`);
      }
    }

    // Save snapshot to file
    const fs = await import('fs');
    fs.writeFileSync(
      'test-results/diagnostic-snapshot.json',
      JSON.stringify(snapshot, null, 2)
    );
    console.log('\n✅ Snapshot saved to test-results/diagnostic-snapshot.json');
  });
});
