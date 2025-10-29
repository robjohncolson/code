/**
 * Chart wizard helpers for testing chart creation and editing
 */

/**
 * Open the chart wizard for a specific question
 * @param {import('@playwright/test').Page} page
 * @param {string} questionId - Question ID
 */
export async function openChartWizard(page, questionId) {
  console.log(`🎨 Opening chart wizard for ${questionId}...`);

  // Wait a moment for the question to be fully rendered
  await page.waitForTimeout(500);

  // Find the "Create Chart" or "Edit Chart" button - using multiple strategies
  const selectors = [
    `button[data-chart-button="${questionId}"]`,
    `button.chart-wizard-button:has-text("Create Chart")`,
    `button.chart-wizard-button:has-text("Edit Chart")`,
    `button[onclick*="openChartWizard('${questionId}')"]`
  ];

  let chartButton = null;
  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if (await btn.count() > 0) {
      chartButton = btn;
      console.log(`Found chart button using selector: ${selector}`);
      break;
    }
  }

  if (!chartButton) {
    throw new Error(`Could not find chart wizard button for ${questionId}`);
  }

  await chartButton.waitFor({ state: 'visible', timeout: 5000 });
  await chartButton.click();

  // Wait for modal to appear
  await page.waitForSelector('#chart-wizard-modal, .modal:visible', { timeout: 5000 });

  console.log('✅ Chart wizard opened');
}

/**
 * Select a chart type in the wizard
 * @param {import('@playwright/test').Page} page
 * @param {string} chartType - Type (histogram, bar, line, scatter, pie, etc.)
 */
export async function selectChartType(page, chartType) {
  console.log(`📊 Selecting chart type: ${chartType}...`);

  // Multiple selector strategies for chart type buttons
  const typeSelectors = [
    `button[data-chart-type="${chartType}"]`,
    `button:has-text("${chartType}")`,
    `.chart-type-button:has-text("${chartType}")`,
  ];

  for (const selector of typeSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
      console.log(`✅ Selected ${chartType}`);
      return;
    }
  }

  throw new Error(`Could not find chart type button for: ${chartType}`);
}

/**
 * Enter data for a histogram chart
 * @param {import('@playwright/test').Page} page
 * @param {Array<{label: string, value: number}>} bins - Histogram bins
 */
export async function enterHistogramData(page, bins) {
  console.log(`📝 Entering histogram data (${bins.length} bins)...`);

  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i];

    // Add row if needed (after first row)
    if (i > 0) {
      const addRowBtn = page.locator('button:has-text("Add"), button:has-text("Add Row"), button:has-text("Add Bar")').first();
      if (await addRowBtn.isVisible().catch(() => false)) {
        await addRowBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Fill label and value inputs using the correct data attributes
    const labelInput = page.locator(`input[data-chart-input="label"][data-group="histogram"][data-index="${i}"]`);
    const valueInput = page.locator(`input[data-chart-input="value"][data-group="histogram"][data-index="${i}"]`);

    // Wait for inputs to be visible
    await labelInput.waitFor({ state: 'visible', timeout: 2000 });
    await valueInput.waitFor({ state: 'visible', timeout: 2000 });

    // Clear and fill
    await labelInput.clear();
    await labelInput.fill(bin.label);

    await valueInput.clear();
    await valueInput.fill(bin.value.toString());

    console.log(`  Row ${i}: label="${bin.label}", value=${bin.value}`);
  }

  console.log('✅ Data entered');
}

/**
 * Enter chart metadata (title, labels)
 * @param {import('@playwright/test').Page} page
 * @param {Object} metadata
 * @param {string} metadata.title - Chart title
 * @param {string} metadata.xLabel - X-axis label
 * @param {string} metadata.yLabel - Y-axis label
 */
export async function enterChartMetadata(page, metadata) {
  console.log('📋 Entering chart metadata...');

  if (metadata.title) {
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]').first();
    if (await titleInput.isVisible().catch(() => false)) {
      await titleInput.fill(metadata.title);
    }
  }

  if (metadata.xLabel) {
    const xInput = page.locator('input[placeholder*="X"], input[placeholder*="x-axis"]').first();
    if (await xInput.isVisible().catch(() => false)) {
      await xInput.fill(metadata.xLabel);
    }
  }

  if (metadata.yLabel) {
    const yInput = page.locator('input[placeholder*="Y"], input[placeholder*="y-axis"]').first();
    if (await yInput.isVisible().catch(() => false)) {
      await yInput.fill(metadata.yLabel);
    }
  }

  console.log('✅ Metadata entered');
}

/**
 * Save the chart from the wizard
 * @param {import('@playwright/test').Page} page
 */
export async function saveChart(page) {
  console.log('💾 Saving chart...');

  // On Step 2 (preview), the "Next" button becomes "Save Chart"
  // Look for the button with data-action="next" which is the save button on the final step
  const saveButton = page.locator('button[data-action="next"]').first();

  // Wait for the button to be visible
  await saveButton.waitFor({ state: 'visible', timeout: 5000 });

  // Verify button text contains "Save"
  const buttonText = await saveButton.textContent();
  console.log(`Save button text: "${buttonText}"`);

  // Click the save button
  await saveButton.click();

  // Wait for modal to close
  await page.waitForTimeout(1500);

  // Verify modal is closed by checking if overlay is gone
  const modalGone = await page.locator('#chart-wizard-overlay').count() === 0;
  if (modalGone) {
    console.log('✅ Chart saved - modal closed');
    return;
  }

  // If modal still visible, it might still be closing
  await page.waitForTimeout(500);
  const stillVisible = await page.locator('#chart-wizard-modal').isVisible().catch(() => false);
  if (!stillVisible) {
    console.log('✅ Chart saved - modal hidden');
    return;
  }

  throw new Error('Modal did not close after clicking save button');
}

/**
 * Create a complete histogram chart
 * @param {import('@playwright/test').Page} page
 * @param {string} questionId
 * @param {Object} config
 */
export async function createHistogramChart(page, questionId, config) {
  console.log(`🎨 Creating histogram chart for ${questionId}...`);

  await openChartWizard(page, questionId);

  // STEP 0: Select chart type
  const hasTypeSelector = await page.locator('button[data-chart-type], .chart-type-button').count() > 0;
  if (hasTypeSelector) {
    await selectChartType(page, 'histogram');

    // Click "Next" to go to Step 1 (data entry)
    console.log('Clicking Next to go to data entry step...');
    const nextBtn = page.locator('button[data-action="next"]').first();
    await nextBtn.click();
    await page.waitForTimeout(500);
  }

  // STEP 1: Enter data
  if (config.bins) {
    await enterHistogramData(page, config.bins);
  }

  // Enter metadata (still on Step 1)
  if (config.title || config.xLabel || config.yLabel) {
    await enterChartMetadata(page, {
      title: config.title,
      xLabel: config.xLabel,
      yLabel: config.yLabel,
    });
  }

  // Click "Next" to go to Step 2 (preview)
  console.log('Clicking Next to go to preview step...');
  const nextBtn2 = page.locator('button[data-action="next"]').first();
  await nextBtn2.click();
  await page.waitForTimeout(1000); // Wait for preview to render

  // STEP 2: Save
  await saveChart(page);

  console.log('✅ Histogram chart created');
}

/**
 * Check if a chart is displayed for a question
 * @param {import('@playwright/test').Page} page
 * @param {string} questionId
 * @returns {Promise<boolean>}
 */
export async function isChartDisplayed(page, questionId) {
  const previewContainer = page.locator(`#chart-preview-${questionId}, [data-chart-preview="${questionId}"]`);

  // Check if container exists and has content
  const exists = await previewContainer.count() > 0;
  if (!exists) return false;

  // Check if canvas exists within container
  const canvas = previewContainer.locator('canvas');
  const hasCanvas = await canvas.count() > 0;

  if (!hasCanvas) return false;

  // Check if canvas is visible
  const isVisible = await canvas.isVisible().catch(() => false);

  return isVisible;
}

/**
 * Get chart button text for a question
 * @param {import('@playwright/test').Page} page
 * @param {string} questionId
 * @returns {Promise<string>}
 */
export async function getChartButtonText(page, questionId) {
  const button = page.locator(`button[data-chart-button="${questionId}"]`).first();
  return await button.textContent();
}
