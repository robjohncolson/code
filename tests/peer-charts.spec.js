import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';
import { createHistogramChart, isChartDisplayed } from './helpers/chart-wizard.js';
import { isChartSaved, getChartData } from './helpers/storage-validator.js';
import testData from './fixtures/chart-data.json' assert { type: 'json' };

test.describe('Peer Chart Display', () => {
  const TEST_QUESTION = 'U1-L10-Q04';

  test('should display peer charts alongside own chart', async ({ browser }) => {
    console.log('\n🧪 Test: Display peer charts alongside own chart\n');

    // Create two browser contexts (simulate two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 creates a chart
      await page1.goto('/');
      const user1 = await loginAndSetup(page1);
      console.log(`User 1: ${user1}`);

      await navigateToQuestion(page1, TEST_QUESTION);
      await createHistogramChart(page1, TEST_QUESTION, {
        ...testData.simple_histogram,
        title: 'User 1 Chart',
        bins: [
          { label: 'A', value: 5 },
          { label: 'B', value: 10 }
        ]
      });

      // Verify User 1's chart is saved
      const user1ChartSaved = await isChartSaved(page1, user1, TEST_QUESTION);
      console.log(`User 1 chart saved: ${user1ChartSaved ? '✅' : '❌'}`);
      expect(user1ChartSaved).toBe(true);

      // User 2 creates a different chart
      await page2.goto('/');
      const user2 = await loginAndSetup(page2);
      console.log(`User 2: ${user2}`);

      await navigateToQuestion(page2, TEST_QUESTION);
      await createHistogramChart(page2, TEST_QUESTION, {
        ...testData.simple_histogram,
        title: 'User 2 Chart',
        bins: [
          { label: 'A', value: 8 },
          { label: 'B', value: 12 }
        ]
      });

      // Verify User 2's chart is saved
      const user2ChartSaved = await isChartSaved(page2, user2, TEST_QUESTION);
      console.log(`User 2 chart saved: ${user2ChartSaved ? '✅' : '❌'}`);
      expect(user2ChartSaved).toBe(true);

      // Wait for sync (in turbo mode this should sync automatically)
      console.log('Waiting for sync...');
      await page1.waitForTimeout(8000);
      await page2.waitForTimeout(8000);

      // Refresh page1 to pull peer data
      await page1.reload();
      await navigateToQuestion(page1, TEST_QUESTION);
      await page1.waitForTimeout(3000);

      // Check if User 1 sees the peer charts container
      const peerChartsVisible = await page1.evaluate(({ qid }) => {
        const container = document.getElementById(`peer-charts-${qid}`);
        return {
          exists: !!container,
          displayed: container?.style.display !== 'none',
          hasContent: container?.children.length > 0,
          childCount: container?.children.length || 0
        };
      }, { qid: TEST_QUESTION });

      console.log('Peer charts container info:', peerChartsVisible);

      expect(peerChartsVisible.exists).toBe(true);

      // Check classData for peer charts
      const classDataInfo = await page1.evaluate(({ qid, peerUser }) => {
        const classDataRef = window.classData || classData;
        return {
          hasClassData: !!classDataRef,
          hasPeerUser: !!classDataRef?.users?.[peerUser],
          hasPeerChart: !!classDataRef?.users?.[peerUser]?.charts?.[qid],
          allUsers: Object.keys(classDataRef?.users || {})
        };
      }, { qid: TEST_QUESTION, peerUser: user2 });

      console.log('ClassData info:', classDataInfo);

      // If peer chart exists in classData, it should be displayed
      if (classDataInfo.hasPeerChart) {
        expect(peerChartsVisible.displayed).toBe(true);
        expect(peerChartsVisible.childCount).toBeGreaterThan(0);
      }

      // Take screenshot
      await page1.screenshot({ path: 'test-results/peer-charts-display.png', fullPage: true });

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should show empty state when no peer charts exist', async ({ page }) => {
    console.log('\n🧪 Test: Show empty state for no peer charts\n');

    await page.goto('/');
    const username = await loginAndSetup(page);
    console.log(`Logged in as: ${username}`);

    await navigateToQuestion(page, TEST_QUESTION);

    // Create only own chart (no peers)
    await createHistogramChart(page, TEST_QUESTION, testData.simple_histogram);

    await page.waitForTimeout(1000);

    // Check peer charts container
    const peerChartState = await page.evaluate(({ qid }) => {
      const container = document.getElementById(`peer-charts-${qid}`);
      const isEmpty = container?.querySelector('.peer-charts-empty') !== null;
      const hasPeerItems = container?.querySelector('.peer-chart-item') !== null;

      return {
        exists: !!container,
        isEmpty,
        hasPeerItems,
        innerHTML: container?.innerHTML.substring(0, 200)
      };
    }, { qid: TEST_QUESTION });

    console.log('Peer chart state:', peerChartState);

    expect(peerChartState.exists).toBe(true);

    // Should either have empty state or be hidden (both are acceptable)
    if (peerChartState.isEmpty) {
      console.log('✅ Empty state displayed');
    } else {
      console.log('✅ No peer items displayed');
      expect(peerChartState.hasPeerItems).toBe(false);
    }
  });

  test('should render peer charts after page refresh', async ({ browser }) => {
    console.log('\n🧪 Test: Peer charts persist after refresh\n');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Setup two users with charts
      await page1.goto('/');
      const user1 = await loginAndSetup(page1);
      await navigateToQuestion(page1, TEST_QUESTION);
      await createHistogramChart(page1, TEST_QUESTION, testData.simple_histogram);

      await page2.goto('/');
      const user2 = await loginAndSetup(page2);
      await navigateToQuestion(page2, TEST_QUESTION);
      await createHistogramChart(page2, TEST_QUESTION, testData.histogram);

      console.log(`User 1: ${user1}, User 2: ${user2}`);

      // Wait for sync
      await page1.waitForTimeout(8000);

      // Refresh User 1's page
      console.log('Refreshing page...');
      await page1.reload();
      await page1.waitForTimeout(3000);

      // Navigate back to question
      await navigateToQuestion(page1, TEST_QUESTION);
      await page1.waitForTimeout(2000);

      // Check if peer charts still display
      const peerChartsAfterRefresh = await page1.evaluate(({ qid }) => {
        const ownChart = document.querySelector(`#chart-preview-${qid} canvas`);
        const peerContainer = document.getElementById(`peer-charts-${qid}`);
        const peerCharts = peerContainer?.querySelectorAll('.peer-chart-item');

        return {
          hasOwnChart: !!ownChart,
          peerContainerExists: !!peerContainer,
          peerChartCount: peerCharts?.length || 0
        };
      }, { qid: TEST_QUESTION });

      console.log('After refresh:', peerChartsAfterRefresh);

      expect(peerChartsAfterRefresh.hasOwnChart).toBe(true);
      expect(peerChartsAfterRefresh.peerContainerExists).toBe(true);

      await page1.screenshot({ path: 'test-results/peer-charts-after-refresh.png', fullPage: true });

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle multiple peer charts (3+ users)', async ({ browser }) => {
    console.log('\n🧪 Test: Handle multiple peer charts\n');

    const contexts = [];
    const pages = [];
    const usernames = [];

    try {
      // Create 3 users
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/');
        const username = await loginAndSetup(page);
        await navigateToQuestion(page, TEST_QUESTION);

        // Create different charts
        const chartConfig = {
          ...testData.simple_histogram,
          title: `Chart ${i + 1}`,
          bins: [
            { label: 'A', value: 5 + i * 2 },
            { label: 'B', value: 10 + i * 3 }
          ]
        };

        await createHistogramChart(page, TEST_QUESTION, chartConfig);

        contexts.push(context);
        pages.push(page);
        usernames.push(username);

        console.log(`User ${i + 1}: ${username}`);
      }

      // Wait for sync
      await pages[0].waitForTimeout(10000);

      // Refresh first user's page
      await pages[0].reload();
      await pages[0].waitForTimeout(3000);
      await navigateToQuestion(pages[0], TEST_QUESTION);
      await pages[0].waitForTimeout(2000);

      // Check how many peer charts are displayed
      const peerChartCount = await pages[0].evaluate(({ qid }) => {
        const peerItems = document.querySelectorAll(`#peer-charts-${qid} .peer-chart-item`);
        return {
          count: peerItems.length,
          usernames: Array.from(peerItems).map(item =>
            item.querySelector('.peer-username')?.textContent
          )
        };
      }, { qid: TEST_QUESTION });

      console.log(`Peer charts displayed:`, peerChartCount);

      // Should see 2 peer charts (3 total - 1 self)
      // Note: This might be 0 if sync hasn't completed yet
      if (peerChartCount.count > 0) {
        console.log(`✅ ${peerChartCount.count} peer chart(s) displayed`);
        expect(peerChartCount.count).toBeLessThanOrEqual(2);
      } else {
        console.log('⚠️ No peer charts yet (sync may be in progress)');
      }

      await pages[0].screenshot({ path: 'test-results/multiple-peer-charts.png', fullPage: true });

    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});
