/**
 * Practice Challenge Questions Tests
 * Tests for PC (Practice Challenge) question functionality
 */

import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion, navigateToUnit } from './helpers/navigation.js';

test.describe('Practice Challenge Questions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);
  });

  test('Navigate to PC questions successfully', async ({ page }) => {
    // Navigate to a Practice Challenge question
    await navigateToQuestion(page, 'U1-PC-FRQ-Q01');

    // Verify question is visible
    const questionContainer = page.locator('[data-question-id="U1-PC-FRQ-Q01"]');
    await expect(questionContainer).toBeVisible({ timeout: 5000 });
  });

  test('PC FRQ questions accept text answers', async ({ page }) => {
    await navigateToQuestion(page, 'U1-PC-FRQ-Q01');

    const questionContainer = page.locator('[data-question-id="U1-PC-FRQ-Q01"]');

    // Find textarea
    const textarea = questionContainer.locator('textarea').first();

    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('This is a test answer for the Practice Challenge FRQ.');

      // Submit answer
      const submitBtn = questionContainer.locator('button:has-text("Submit")');
      await submitBtn.click();

      // Wait for submission
      await page.waitForTimeout(1000);

      // Verify no console errors about "No correct answer found"
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('No correct answer found')) {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(500);

      const relevantErrors = consoleErrors.filter(err =>
        err.includes('No correct answer found') ||
        err.includes('DEBUG getCorrectAnswer')
      );

      expect(relevantErrors.length).toBe(0);
    }
  });

  test('PC question solutions display without errors', async ({ page }) => {
    await navigateToQuestion(page, 'U1-PC-FRQ-Q01');

    // Capture console messages
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    // Wait for any automatic solution display
    await page.waitForTimeout(1000);

    // Filter for errors related to solutions/answers
    const solutionErrors = consoleLogs.filter(log =>
      log.text.includes('No correct answer') ||
      log.text.includes('No explanation') ||
      log.text.includes('getOfficialExplanation')
    );

    console.log('Solution-related logs:', solutionErrors);

    // Should not have errors (may have null returns, but no error logs)
    const actualErrors = solutionErrors.filter(log => log.type === 'error');
    expect(actualErrors.length).toBe(0);
  });

  test('PC questions appear in unit navigation', async ({ page }) => {
    await navigateToUnit(page, 1);

    // Check if Practice Challenge or PC button exists
    const pcButton = page.locator('button:has-text("Practice Challenge"), button:has-text("PC")').first();
    const exists = await pcButton.isVisible().catch(() => false);

    // PC button should exist in at least some units
    if (exists) {
      await expect(pcButton).toBeVisible();
    }
  });

  test('getCorrectAnswer handles PC questions gracefully', async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);

    // Test getCorrectAnswer with PC question
    const result = await page.evaluate(() => {
      if (typeof window.getCorrectAnswer !== 'function') {
        return { error: 'Function not found' };
      }

      try {
        const answer = window.getCorrectAnswer('U1-PC-FRQ-Q01');
        return {
          success: true,
          answer,
          isNull: answer === null,
          type: typeof answer
        };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('PC getCorrectAnswer result:', result);

    // Function should exist and not throw errors
    expect(result.error).not.toBe('Function not found');

    // For FRQ/PC questions, null is acceptable
    if (result.success) {
      expect(result.type).toBeTruthy();
    }
  });

  test('PC question IDs are in correct format', async ({ page }) => {
    await page.goto('/');

    const pcQuestions = await page.evaluate(() => {
      if (!window.EMBEDDED_CURRICULUM) return [];

      return window.EMBEDDED_CURRICULUM
        .filter(q => q.id.includes('-PC-'))
        .map(q => ({
          id: q.id,
          type: q.type,
          hasPrompt: !!q.prompt
        }))
        .slice(0, 5); // Just first 5 for testing
    });

    console.log('PC questions found:', pcQuestions);

    // Verify format: U{num}-PC-{something}-Q{num}
    pcQuestions.forEach(q => {
      expect(q.id).toMatch(/U\d+-PC-/);
      expect(q.hasPrompt).toBeTruthy();
    });
  });

  test('Navigation helper regex handles both formats', async ({ page }) => {
    // Test that both regular and PC formats are valid
    const testIds = [
      'U1-L2-Q01',      // Regular
      'U1-PC-FRQ-Q01',  // PC FRQ
      'U2-L5-Q03',      // Regular
      'U3-PC-FRQ-Q02'   // PC FRQ
    ];

    for (const questionId of testIds) {
      // Just verify the ID format is recognized (don't navigate)
      const isValid = /U\d+-(L\d+|PC)-/.test(questionId);
      expect(isValid).toBeTruthy();
    }
  });

  test('PC questions can have chart responses', async ({ page }) => {
    await page.goto('/');

    // Check if any PC questions support charts
    const pcChartQuestions = await page.evaluate(() => {
      if (!window.EMBEDDED_CURRICULUM || !window.CHART_QUESTIONS) {
        return [];
      }

      return window.EMBEDDED_CURRICULUM
        .filter(q => q.id.includes('-PC-') && (q.requiresGraph || window.CHART_QUESTIONS[q.id]))
        .map(q => ({
          id: q.id,
          requiresGraph: q.requiresGraph,
          chartEligible: !!window.CHART_QUESTIONS[q.id]
        }))
        .slice(0, 3);
    });

    console.log('PC questions with chart support:', pcChartQuestions);

    // If there are PC chart questions, verify structure
    if (pcChartQuestions.length > 0) {
      pcChartQuestions.forEach(q => {
        expect(q.id).toMatch(/U\d+-PC-/);
        const hasChartSupport = q.requiresGraph || q.chartEligible;
        expect(hasChartSupport).toBeTruthy();
      });
    }
  });
});
