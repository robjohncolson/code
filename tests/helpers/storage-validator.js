/**
 * localStorage validation helpers
 */

/**
 * Get classData from localStorage
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>}
 */
export async function getClassData(page) {
  return await page.evaluate(() => {
    const data = localStorage.getItem('classData');
    return data ? JSON.parse(data) : null;
  });
}

/**
 * Get a specific user's data from classData
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @returns {Promise<Object>}
 */
export async function getUserData(page, username) {
  return await page.evaluate((uname) => {
    const data = localStorage.getItem('classData');
    if (!data) return null;
    const classData = JSON.parse(data);
    return classData.users?.[uname] || null;
  }, username);
}

/**
 * Check if a chart is saved in localStorage
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} questionId
 * @returns {Promise<boolean>}
 */
export async function isChartSaved(page, username, questionId) {
  return await page.evaluate(({ uname, qid }) => {
    const data = localStorage.getItem('classData');
    if (!data) return false;

    const classData = JSON.parse(data);
    const user = classData.users?.[uname];
    if (!user) return false;

    // Check in charts collection
    if (user.charts && user.charts[qid]) {
      return true;
    }

    // Check in answers collection
    if (user.answers && user.answers[qid]) {
      const answer = user.answers[qid];
      // Check if it's a chart object
      if (answer && typeof answer === 'object' &&
          (answer.type || answer.chartType)) {
        return true;
      }
    }

    return false;
  }, { uname: username, qid: questionId });
}

/**
 * Get chart data from localStorage
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} questionId
 * @returns {Promise<Object|null>}
 */
export async function getChartData(page, username, questionId) {
  return await page.evaluate(({ uname, qid }) => {
    const data = localStorage.getItem('classData');
    if (!data) return null;

    const classData = JSON.parse(data);
    const user = classData.users?.[uname];
    if (!user) return null;

    // Try charts collection first
    if (user.charts && user.charts[qid]) {
      return user.charts[qid];
    }

    // Try answers collection
    if (user.answers && user.answers[qid]) {
      const answer = user.answers[qid];
      if (answer && typeof answer === 'object' &&
          (answer.type || answer.chartType)) {
        return answer;
      }
    }

    return null;
  }, { uname: username, qid: questionId });
}

/**
 * Verify chart data structure is correct
 * @param {Object} chartData
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateChartStructure(chartData) {
  const errors = [];

  if (!chartData) {
    errors.push('Chart data is null or undefined');
    return { valid: false, errors };
  }

  if (typeof chartData !== 'object') {
    errors.push('Chart data is not an object');
    return { valid: false, errors };
  }

  // Check for required properties
  if (!chartData.type && !chartData.chartType) {
    errors.push('Missing type or chartType property');
  }

  // Type-specific validation
  const chartType = chartData.type || chartData.chartType;

  switch (chartType) {
    case 'histogram':
      // Check for either data.bins (legacy) or binning.bins (current SIF format)
      const bins = chartData.data?.bins || chartData.binning?.bins;
      if (!bins) {
        errors.push('Histogram missing bins (expected data.bins or binning.bins)');
      } else if (!Array.isArray(bins)) {
        errors.push('Histogram bins is not an array');
      }
      break;

    case 'bar':
    case 'line':
      if (!chartData.series || !Array.isArray(chartData.series)) {
        errors.push(`${chartType} missing series array`);
      }
      if (!chartData.categories || !Array.isArray(chartData.categories)) {
        errors.push(`${chartType} missing categories array`);
      }
      break;

    case 'scatter':
    case 'bubble':
      if (!chartData.points || !Array.isArray(chartData.points)) {
        errors.push(`${chartType} missing points array`);
      }
      break;

    case 'pie':
    case 'doughnut':
      if (!chartData.segments || !Array.isArray(chartData.segments)) {
        errors.push(`${chartType} missing segments array`);
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get all saved charts for a user
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @returns {Promise<Object>}
 */
export async function getAllCharts(page, username) {
  return await page.evaluate((uname) => {
    const data = localStorage.getItem('classData');
    if (!data) return {};

    const classData = JSON.parse(data);
    const user = classData.users?.[uname];
    if (!user) return {};

    return user.charts || {};
  }, username);
}

/**
 * Check if saveClassData function is available
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isSaveFunctionAvailable(page) {
  return await page.evaluate(() => {
    return typeof window.saveClassData === 'function';
  });
}

/**
 * Check if chart wizard functions are available
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>}
 */
export async function getChartWizardStatus(page) {
  return await page.evaluate(() => {
    return {
      openChartWizard: typeof window.openChartWizard === 'function',
      renderChartWizardPreview: typeof window.renderChartWizardPreview === 'function',
      saveClassData: typeof window.saveClassData === 'function',
      chartsModule: !!window.charts,
      renderChartNow: typeof window.charts?.renderChartNow === 'function',
      getChartHtml: typeof window.charts?.getChartHtml === 'function',
    };
  });
}

/**
 * Get localStorage size in bytes
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function getLocalStorageSize(page) {
  return await page.evaluate(() => {
    const data = localStorage.getItem('classData');
    return data ? new Blob([data]).size : 0;
  });
}

/**
 * Clear all localStorage data
 * @param {import('@playwright/test').Page} page
 */
export async function clearLocalStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Capture full storage snapshot for debugging
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>}
 */
export async function captureStorageSnapshot(page) {
  return await page.evaluate(() => {
    const snapshot = {
      timestamp: Date.now(),
      localStorage: {},
      sessionStorage: {},
      classData: null,
      username: null,
    };

    // Capture all localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      snapshot.localStorage[key] = localStorage.getItem(key);
    }

    // Parse classData if available
    if (snapshot.localStorage.classData) {
      try {
        snapshot.classData = JSON.parse(snapshot.localStorage.classData);
      } catch (e) {
        snapshot.classData = { error: 'Failed to parse' };
      }
    }

    // Get username
    snapshot.username = localStorage.getItem('consensusUsername');

    return snapshot;
  });
}
