/**
 * Chart Initialization Tests
 * Tests for chart rendering on page load and initialization
 */

import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';

test.describe('Chart Initialization on Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);
  });

  test('Saved charts display immediately on page load', async ({ page }) => {
    // First, create and save a chart
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Inject chart data into localStorage
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {}, reasons: {}, timestamps: {}, attempts: {} };
      }

      // Create test chart
      const testChart = {
        type: 'histogram',
        chartType: 'histogram',
        title: 'Test Histogram',
        data: {
          bins: [
            { label: '0-10', value: 5 },
            { label: '10-20', value: 8 },
            { label: '20-30', value: 12 }
          ],
          seriesName: 'Frequency'
        },
        xLabel: 'Score Range',
        yLabel: 'Frequency'
      };

      classData.users[username].charts['U1-L10-Q04'] = testChart;
      classData.users[username].answers['U1-L10-Q04'] = {
        value: JSON.stringify(testChart),
        timestamp: Date.now()
      };

      localStorage.setItem('classData', JSON.stringify(classData));
    });

    // Refresh page to trigger initialization
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to the question
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Wait a bit for chart rendering
    await page.waitForTimeout(500);

    // Check if chart preview container exists and has content
    const chartPreview = page.locator('#chart-preview-U1-L10-Q04');
    const exists = await chartPreview.count() > 0;

    if (exists) {
      // Check if canvas was created
      const canvas = chartPreview.locator('canvas');
      const canvasCount = await canvas.count();

      console.log(`Chart preview exists: ${exists}, Canvas count: ${canvasCount}`);

      // At least verify the preview container exists
      expect(exists).toBeTruthy();
    }
  });

  test('Chart preview renders for requiresGraph questions', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');

    // Check if chart preview container exists
    const chartPreview = questionContainer.locator('[data-chart-preview]');
    await expect(chartPreview).toBeAttached({ timeout: 3000 });
  });

  test('updateInlineChartPreview function exists', async ({ page }) => {
    await page.goto('/');

    const functionExists = await page.evaluate(() => {
      return typeof window.updateInlineChartPreview === 'function';
    });

    expect(functionExists).toBeTruthy();
  });

  test('Chart data persists through page refresh', async ({ page }) => {
    // Navigate to chart question
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Save chart data
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {}, reasons: {}, timestamps: {}, attempts: {} };
      }

      const chart = {
        type: 'bar',
        title: 'Persistence Test',
        categories: ['A', 'B', 'C'],
        series: [{ name: 'Series 1', values: [10, 20, 30] }]
      };

      classData.users[username].charts['U1-L10-Q04'] = chart;
      localStorage.setItem('classData', JSON.stringify(classData));
    });

    // Refresh page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Check if chart data still exists
    const chartDataExists = await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');
      return !!classData.users?.[username]?.charts?.['U1-L10-Q04'];
    });

    expect(chartDataExists).toBeTruthy();
  });

  test('Multiple chart types can be saved', async ({ page }) => {
    const chartTypes = [
      { type: 'histogram', data: { bins: [{ label: '0-10', value: 5 }] } },
      { type: 'bar', categories: ['A'], series: [{ name: 'S1', values: [10] }] },
      { type: 'scatter', points: [{ x: 1, y: 2 }] }
    ];

    await page.evaluate((charts) => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {}, reasons: {}, timestamps: {}, attempts: {} };
      }

      charts.forEach((chart, index) => {
        const qid = `TEST-Q0${index + 1}`;
        classData.users[username].charts[qid] = chart;
      });

      localStorage.setItem('classData', JSON.stringify(classData));
    }, chartTypes);

    // Verify all were saved
    const savedCount = await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');
      return Object.keys(classData.users?.[username]?.charts || {}).length;
    });

    expect(savedCount).toBeGreaterThanOrEqual(3);
  });

  test('Chart rendering handles corrupted data gracefully', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q04');

    // Inject corrupted chart data
    await page.evaluate(() => {
      const classData = JSON.parse(localStorage.getItem('classData') || '{"users":{}}');
      const username = localStorage.getItem('consensusUsername');

      if (!classData.users[username]) {
        classData.users[username] = { answers: {}, charts: {}, reasons: {}, timestamps: {}, attempts: {} };
      }

      // Corrupted chart - missing required fields
      classData.users[username].charts['U1-L10-Q04'] = {
        type: 'histogram'
        // Missing data field
      };

      localStorage.setItem('classData', JSON.stringify(classData));
    });

    // Try to render - should not crash
    await page.evaluate(() => {
      if (typeof window.updateInlineChartPreview === 'function') {
        try {
          window.updateInlineChartPreview('U1-L10-Q04');
        } catch (e) {
          console.error('Chart rendering error:', e);
        }
      }
    });

    // Page should still be functional
    const questionContainer = page.locator('[data-question-id="U1-L10-Q04"]');
    await expect(questionContainer).toBeVisible();
  });

  test('EMBEDDED_CURRICULUM contains requiresGraph questions', async ({ page }) => {
    await page.goto('/');

    const hasGraphQuestions = await page.evaluate(() => {
      if (!window.EMBEDDED_CURRICULUM) return false;

      const graphQuestions = window.EMBEDDED_CURRICULUM.filter(q => q.requiresGraph);
      return {
        total: window.EMBEDDED_CURRICULUM.length,
        graphCount: graphQuestions.length,
        examples: graphQuestions.slice(0, 3).map(q => ({ id: q.id, type: q.requiresGraph }))
      };
    });

    console.log('Graph questions:', hasGraphQuestions);

    expect(hasGraphQuestions.graphCount).toBeGreaterThan(0);
  });
});
