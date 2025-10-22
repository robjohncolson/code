/**
 * test_runner.js - Test Runner Configuration
 * Orchestrates test execution and reporting
 */

// QUnit configuration
QUnit.config.autostart = false;
QUnit.config.reorder = false; // Run tests in order
QUnit.config.testTimeout = 10000; // 10s timeout per test

// Track test results for CI
window.TestResults = {
    passed: 0,
    failed: 0,
    total: 0,
    startTime: null,
    endTime: null,
    failures: []
};

// Listen to test events
QUnit.testDone((details) => {
    window.TestResults.total++;

    if (details.failed === 0) {
        window.TestResults.passed++;
    } else {
        window.TestResults.failed++;
        window.TestResults.failures.push({
            module: details.module,
            name: details.name,
            assertions: details.assertions.filter(a => !a.result)
        });
    }
});

QUnit.begin(() => {
    window.TestResults.startTime = Date.now();
    console.log('🧪 Test Suite Starting...');
    console.log('═'.repeat(60));
});

QUnit.done((details) => {
    window.TestResults.endTime = Date.now();
    const duration = ((window.TestResults.endTime - window.TestResults.startTime) / 1000).toFixed(2);

    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${details.passed}`);
    console.log(`❌ Failed: ${details.failed}`);
    console.log(`📊 Total: ${details.total}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('═'.repeat(60));

    // Report failures
    if (window.TestResults.failures.length > 0) {
        console.log('\n❌ Failed Tests:');
        window.TestResults.failures.forEach((failure, index) => {
            console.log(`\n${index + 1}. ${failure.module} - ${failure.name}`);
            failure.assertions.forEach(assertion => {
                console.log(`   Expected: ${assertion.expected}`);
                console.log(`   Actual: ${assertion.actual}`);
                console.log(`   Message: ${assertion.message}`);
            });
        });
    }

    // Exit code for CI (if in headless mode)
    if (typeof window.callPhantom === 'function') {
        window.callPhantom({
            exitCode: details.failed > 0 ? 1 : 0
        });
    }

    // For Playwright/Puppeteer
    if (window.__coverage__) {
        console.log('📈 Coverage data collected');
    }
});

QUnit.moduleStart((details) => {
    console.log(`\n📂 Module: ${details.name}`);
});

QUnit.testStart((details) => {
    console.log(`  🧪 ${details.name}`);
});

// Start tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        QUnit.start();
    });
} else {
    QUnit.start();
}

// Expose utility for CI to check results
window.getTestResults = function() {
    return {
        ...window.TestResults,
        duration: window.TestResults.endTime - window.TestResults.startTime,
        success: window.TestResults.failed === 0
    };
};
