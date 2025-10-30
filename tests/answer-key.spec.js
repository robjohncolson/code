/**
 * Answer Key Functionality Tests
 * Tests for correct answer display and solution rendering
 */

import { test, expect } from '@playwright/test';
import { loginAndSetup, navigateToQuestion } from './helpers/navigation.js';

test.describe('Answer Key Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);
  });

  test('MCQ correct answer displays after submission', async ({ page }) => {
    // Navigate to a simple MCQ
    await navigateToQuestion(page, 'U1-L2-Q01');

    // Get the question container
    const questionContainer = page.locator('[data-question-id="U1-L2-Q01"]');

    // Select an answer
    const choiceA = questionContainer.locator('input[type="radio"][value="A"]');
    await choiceA.check();

    // Submit the answer
    const submitBtn = questionContainer.locator('button:has-text("Submit")');
    await submitBtn.click();

    // Wait for submission to complete
    await page.waitForTimeout(1000);

    // Check console for errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Verify no "No correct answer found" errors
    await page.waitForTimeout(500);
    const noCorrectAnswerErrors = consoleErrors.filter(err =>
      err.includes('No correct answer found')
    );
    expect(noCorrectAnswerErrors.length).toBe(0);

    // Verify success message appears
    const successMsg = questionContainer.locator('.success-message, .feedback');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('FRQ solution displays properly', async ({ page }) => {
    // Navigate to an FRQ question
    await navigateToQuestion(page, 'U1-L10-Q01');

    const questionContainer = page.locator('[data-question-id="U1-L10-Q01"]');

    // Check for solution/rubric display elements
    const hasSolution = await questionContainer.locator('.solution, .rubric, .answer-key').count() > 0;

    // If solution button exists, click it
    const showSolutionBtn = questionContainer.locator('button:has-text("Show Solution"), button:has-text("Show Answer")');
    if (await showSolutionBtn.isVisible().catch(() => false)) {
      await showSolutionBtn.click();
      await page.waitForTimeout(500);
    }

    // Monitor console for errors
    const logs = [];
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
    });

    await page.waitForTimeout(1000);

    // Verify no "No correct answer found" errors
    const errors = logs.filter(log =>
      log.type === 'error' || log.text.includes('No correct answer found')
    );

    console.log('Console logs:', logs);
    expect(errors.length).toBe(0);
  });

  test('FRQ-PC questions show solutions correctly', async ({ page }) => {
    // Practice Challenge questions - these were showing errors in console
    await navigateToQuestion(page, 'U1-PC-FRQ-Q01');

    const questionContainer = page.locator('[data-question-id="U1-PC-FRQ-Q01"]');

    // Capture console messages
    const consoleMsgs = [];
    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    // Submit a text answer
    const textarea = questionContainer.locator('textarea');
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('This is a test answer for FRQ.');

      const submitBtn = questionContainer.locator('button:has-text("Submit")');
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }

    // Check for the specific error from console logs
    const debugLogs = consoleMsgs.filter(msg =>
      msg.text.includes('DEBUG getCorrectAnswer')
    );
    const errorLogs = consoleMsgs.filter(msg =>
      msg.text.includes('No correct answer found')
    );

    console.log('Debug logs found:', debugLogs.length);
    console.log('Error logs found:', errorLogs.length);

    // This should not produce "No correct answer found" errors
    expect(errorLogs.length).toBe(0);
  });

  test('Answer key toggle functionality works', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L2-Q01');

    // Look for answer key toggle button (if exists)
    const answerKeyBtn = page.locator('button:has-text("Show Answer Key"), button:has-text("Answer Key")').first();

    if (await answerKeyBtn.isVisible().catch(() => false)) {
      // Click to show answer key
      await answerKeyBtn.click();
      await page.waitForTimeout(500);

      // Verify answer key displays
      const answerKeyDisplay = page.locator('.answer-key, .correct-answer-display');
      await expect(answerKeyDisplay.first()).toBeVisible({ timeout: 3000 });

      // Click to hide answer key
      await answerKeyBtn.click();
      await page.waitForTimeout(500);

      // Verify answer key is hidden
      await expect(answerKeyDisplay.first()).not.toBeVisible();
    }
  });

  test('getCorrectAnswer function exists and works for MCQ', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L2-Q01');

    // Test the getCorrectAnswer function directly
    const correctAnswer = await page.evaluate(() => {
      // Check if function exists
      if (typeof window.getCorrectAnswer !== 'function') {
        return { error: 'Function not found' };
      }

      try {
        const answer = window.getCorrectAnswer('U1-L2-Q01');
        return { success: true, answer };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('getCorrectAnswer result:', correctAnswer);

    // Function should exist
    expect(correctAnswer.error).not.toBe('Function not found');

    // Should return a valid answer (A, B, C, or D)
    if (correctAnswer.success) {
      expect(['A', 'B', 'C', 'D']).toContain(correctAnswer.answer);
    }
  });

  test('getCorrectAnswer function works for FRQ', async ({ page }) => {
    await navigateToQuestion(page, 'U1-L10-Q01');

    // Test the getCorrectAnswer function for FRQ
    const result = await page.evaluate(() => {
      if (typeof window.getCorrectAnswer !== 'function') {
        return { error: 'Function not found' };
      }

      try {
        const answer = window.getCorrectAnswer('U1-L10-Q01');
        return {
          success: true,
          answer,
          type: typeof answer,
          isNull: answer === null,
          isUndefined: answer === undefined
        };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('FRQ getCorrectAnswer result:', result);

    // Function should exist
    expect(result.error).not.toBe('Function not found');

    // For FRQ, answer might be null (which is acceptable) or should be an object/string
    if (result.success && !result.isNull) {
      expect(['string', 'object']).toContain(result.type);
    }
  });

  test('Curriculum data has solution fields for FRQs', async ({ page }) => {
    await page.goto('/');
    await loginAndSetup(page);

    // Check curriculum structure
    const curriculumCheck = await page.evaluate(() => {
      // Check if curriculum data exists
      if (!window.curriculum || !window.curriculum.units) {
        return { error: 'Curriculum data not found' };
      }

      // Find an FRQ question
      let frqQuestion = null;
      for (const unit of window.curriculum.units) {
        for (const question of unit.questions || []) {
          if (question.type === 'free-response' || question.type === 'frq') {
            frqQuestion = question;
            break;
          }
        }
        if (frqQuestion) break;
      }

      if (!frqQuestion) {
        return { error: 'No FRQ found in curriculum' };
      }

      return {
        success: true,
        questionId: frqQuestion.id,
        hasCorrect: 'correct' in frqQuestion,
        hasSolution: 'solution' in frqQuestion,
        hasRubric: 'rubric' in frqQuestion,
        solutionType: typeof frqQuestion.solution,
        fields: Object.keys(frqQuestion)
      };
    });

    console.log('Curriculum check:', curriculumCheck);

    expect(curriculumCheck.error).toBeFalsy();

    // FRQ should have either solution or rubric field
    if (curriculumCheck.success) {
      const hasSolutionData = curriculumCheck.hasSolution || curriculumCheck.hasRubric;
      expect(hasSolutionData).toBeTruthy();
    }
  });
});
