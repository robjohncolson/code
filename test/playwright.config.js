/**
 * playwright.config.js - Playwright Configuration for Frontend Tests
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './test',
    testMatch: '*.playwright.js',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Run tests sequentially to avoid localStorage conflicts
    reporter: process.env.CI ? 'github' : 'list',

    use: {
        baseURL: 'http://localhost:8000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'python3 -m http.server 8000 || python -m http.server 8000 || npx http-server -p 8000',
        port: 8000,
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
    },
});
