/**
 * Navigation helpers for AP Stats Quiz tests
 */

/**
 * Complete the initial login/username setup
 * @param {import('@playwright/test').Page} page
 * @param {string} username - Optional username, will generate if not provided
 * @returns {Promise<string>} The username used
 */
export async function loginAndSetup(page, username = null) {
  console.log('🔐 Starting login process...');

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // Check if already logged in
  const existingUsername = await page.evaluate(() => {
    return localStorage.getItem('consensusUsername');
  });

  if (existingUsername && !username) {
    console.log(`✅ Already logged in as: ${existingUsername}`);
    return existingUsername;
  }

  // Look for username prompt or welcome screen
  const hasWelcomeScreen = await page.locator('text=/Welcome|New Student|I\'m a New Student/i').count() > 0;

  if (hasWelcomeScreen) {
    console.log('📝 Setting up new user...');

    // Click "I'm a New Student" if present
    const newStudentBtn = page.locator('button:has-text("I\'m a New Student"), button:has-text("New Student")').first();
    if (await newStudentBtn.isVisible().catch(() => false)) {
      await newStudentBtn.click();
      await page.waitForTimeout(500);
    }

    // Generate or use provided username
    const finalUsername = username || `Test_User_${Date.now()}`;

    // Try to find username input
    const usernameInput = page.locator('input[type="text"]').first();
    if (await usernameInput.isVisible().catch(() => false)) {
      await usernameInput.fill(finalUsername);

      // Find and click continue/submit button
      const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Start"), button:has-text("Submit")').first();
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
      }
    } else {
      // Directly set in localStorage if no UI prompt
      await page.evaluate((name) => {
        localStorage.setItem('consensusUsername', name);
      }, finalUsername);
      await page.reload();
    }

    // Wait for units to appear
    await page.waitForSelector('text=/Unit 1|Unit 2/i', { timeout: 10000 });
    console.log(`✅ Logged in as: ${finalUsername}`);
    return finalUsername;
  }

  // Already on main screen - wait for units to be visible
  await page.waitForSelector('text=/Unit 1|Unit 2/i', { timeout: 10000 }).catch(() => {
    console.log('⚠️ Units not visible yet, waiting longer...');
  });

  const currentUser = await page.evaluate(() => {
    return localStorage.getItem('consensusUsername');
  });

  console.log(`✅ User ready: ${currentUser}`);
  return currentUser;
}

/**
 * Navigate to a specific unit
 * @param {import('@playwright/test').Page} page
 * @param {number} unitNumber - Unit number (1-9)
 */
export async function navigateToUnit(page, unitNumber) {
  console.log(`📚 Navigating to Unit ${unitNumber}...`);

  // Wait for units to be visible
  await page.waitForSelector('text=/Unit 1|Unit/i', { timeout: 10000 });

  // Click the unit card - these are clickable divs, not buttons
  // Try multiple selector strategies
  const selectors = [
    `h3:has-text("Unit ${unitNumber}")`, // Click the heading
    `:text("Unit ${unitNumber}")`, // Click any element with this text
    `.unit-card:has-text("Unit ${unitNumber}")`, // If there's a unit-card class
  ];

  let clicked = false;
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      await element.click();
      clicked = true;
      console.log(`✅ Clicked unit using selector: ${selector}`);
      break;
    }
  }

  if (!clicked) {
    throw new Error(`Could not find Unit ${unitNumber}`);
  }

  // Wait for lessons to appear
  await page.waitForSelector('text=/Lesson|Topic/i', { timeout: 5000 });
  console.log(`✅ Unit ${unitNumber} opened`);
}

/**
 * Navigate to a specific lesson within current unit
 * @param {import('@playwright/test').Page} page
 * @param {number} lessonNumber - Lesson number
 */
export async function navigateToLesson(page, lessonNumber) {
  console.log(`📖 Navigating to Lesson ${lessonNumber}...`);

  // Multiple selector strategies for lesson buttons
  const lessonSelectors = [
    `button:has-text("Lesson ${lessonNumber}")`,
    `button:has-text("L${lessonNumber}")`,
    `button:has-text("${lessonNumber}.")`,
    `[data-lesson="${lessonNumber}"]`,
  ];

  for (const selector of lessonSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      // Wait for questions to load
      await page.waitForSelector('[data-question-id], .question-header', { timeout: 5000 });
      console.log(`✅ Lesson ${lessonNumber} opened`);
      return;
    }
  }

  throw new Error(`Could not find Lesson ${lessonNumber} button`);
}

/**
 * Navigate directly to a specific question
 * @param {import('@playwright/test').Page} page
 * @param {string} questionId - Question ID (e.g., 'U1-L10-Q04')
 */
export async function navigateToQuestion(page, questionId) {
  console.log(`🎯 Navigating to question ${questionId}...`);

  // Parse question ID
  const match = questionId.match(/U(\d+)-L(\d+)-Q(\d+)/);
  if (!match) {
    throw new Error(`Invalid question ID format: ${questionId}`);
  }

  const [, unit, lesson] = match;

  // Navigate to unit
  await navigateToUnit(page, parseInt(unit));

  // Navigate to lesson
  await navigateToLesson(page, parseInt(lesson));

  // Verify question is visible - use more specific selector
  const questionSelector = `.quiz-container[data-question-id="${questionId}"]`;
  await page.waitForSelector(questionSelector, { timeout: 5000 });

  // Scroll question into view
  await page.locator(questionSelector).first().scrollIntoViewIfNeeded();

  console.log(`✅ Question ${questionId} is visible`);
}

/**
 * Navigate back to units menu
 * @param {import('@playwright/test').Page} page
 */
export async function navigateBackToUnits(page) {
  console.log('🔙 Navigating back to units...');

  // Look for back button
  const backBtn = page.locator('button:has-text("Back"), button:has-text("← Back")').first();

  let clicks = 0;
  while (clicks < 3) { // Maximum 3 clicks to get back to units
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
      clicks++;

      // Check if we're back at units
      const hasUnits = await page.locator('text=/Unit 1|Unit 2/i').isVisible().catch(() => false);
      if (hasUnits) {
        console.log('✅ Back at units menu');
        return;
      }
    } else {
      break;
    }
  }

  console.log('✅ Navigation complete');
}
