import { loginAndSetup, navigateToQuestion } from './navigation.js';
import { createHistogramChart } from './chart-wizard.js';

/**
 * Setup two users in separate browser contexts
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{page1: Page, page2: Page, user1: string, user2: string, context1: BrowserContext, context2: BrowserContext}>}
 */
export async function setupTwoUsers(browser) {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('/');
  const user1 = await loginAndSetup(page1);

  await page2.goto('/');
  const user2 = await loginAndSetup(page2);

  return { page1, page2, user1, user2, context1, context2 };
}

/**
 * Setup three users in separate browser contexts
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{pages: Page[], users: string[], contexts: BrowserContext[]}>}
 */
export async function setupThreeUsers(browser) {
  const contexts = [];
  const pages = [];
  const users = [];

  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');
    const username = await loginAndSetup(page);

    contexts.push(context);
    pages.push(page);
    users.push(username);
  }

  return {
    pages,
    users,
    contexts,
    page1: pages[0],
    page2: pages[1],
    page3: pages[2],
    user1: users[0],
    user2: users[1],
    user3: users[2]
  };
}

/**
 * Create multiple users with charts on the same question
 * @param {import('@playwright/test').Browser} browser
 * @param {number} userCount - Number of users to create
 * @param {string} questionId - Question ID to create charts for
 * @param {Object} chartDataTemplate - Template for chart data
 * @returns {Promise<Array<{page: Page, username: string, context: BrowserContext}>>}
 */
export async function createMultipleUsersWithCharts(browser, userCount, questionId, chartDataTemplate = null) {
  const users = [];

  for (let i = 0; i < userCount; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');
    const username = await loginAndSetup(page);

    await navigateToQuestion(page, questionId);

    // Create chart with slight variations
    const chartConfig = chartDataTemplate || {
      type: 'histogram',
      title: `Chart ${i + 1}`,
      xLabel: 'Category',
      yLabel: 'Frequency',
      bins: [
        { label: 'A', value: 5 + i },
        { label: 'B', value: 10 + i * 2 }
      ]
    };

    await createHistogramChart(page, questionId, chartConfig);

    users.push({ page, username, context });
  }

  return users;
}

/**
 * Close all browser contexts
 * @param {Array<BrowserContext>} contexts
 */
export async function closeAllContexts(contexts) {
  for (const context of contexts) {
    await context.close();
  }
}

/**
 * Wait for peer data to sync across users
 * @param {Array<Page>} pages
 * @param {number} waitTime - Time to wait in milliseconds (default 8000)
 */
export async function waitForPeerSync(pages, waitTime = 8000) {
  console.log(`Waiting ${waitTime}ms for peer data sync...`);
  await Promise.all(pages.map(page => page.waitForTimeout(waitTime)));
}

/**
 * Check if peer charts are displayed for a user
 * @param {Page} page
 * @param {string} questionId
 * @returns {Promise<{exists: boolean, displayed: boolean, count: number}>}
 */
export async function checkPeerChartsDisplayed(page, questionId) {
  return await page.evaluate((qid) => {
    const container = document.getElementById(`peer-charts-${qid}`);
    const peerItems = container?.querySelectorAll('.peer-chart-item');

    return {
      exists: !!container,
      displayed: container?.style.display !== 'none',
      count: peerItems?.length || 0,
      hasEmpty: !!container?.querySelector('.peer-charts-empty')
    };
  }, questionId);
}
