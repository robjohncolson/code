/**
 * Quick Test for Chart Persistence
 * Run this in console to test if charts are working
 */

(function() {
    console.clear();
    console.log('%c🧪 CHART PERSISTENCE QUICK TEST', 'color: blue; font-size: 16px; font-weight: bold');
    console.log('='.repeat(50));

    const username = localStorage.getItem('consensusUsername');

    if (!username) {
        console.error('❌ Please log in first!');
        return;
    }

    console.log('Username:', username);

    // Test 1: Check if save function is available
    console.log('\n1️⃣ Checking save function...');
    if (typeof window.saveClassData === 'function') {
        console.log('✅ saveClassData is available');
    } else {
        console.error('❌ saveClassData NOT available - charts cannot be saved!');
        console.error('   Fix: Refresh the page to reload data_manager.js');
    }

    // Test 2: Check if chart wizard is available
    console.log('\n2️⃣ Checking chart wizard...');
    if (typeof window.openChartWizard === 'function') {
        console.log('✅ Chart wizard is available');
    } else {
        console.error('❌ Chart wizard NOT loaded');
        console.error('   Fix: Refresh the page to reload chart_wizard.js');
    }

    // Test 3: Check for saved charts
    console.log('\n3️⃣ Checking for saved charts...');
    const data = JSON.parse(localStorage.getItem('classData') || '{}');
    const userCharts = data.users?.[username]?.charts;

    if (userCharts && Object.keys(userCharts).length > 0) {
        console.log(`✅ Found ${Object.keys(userCharts).length} saved charts:`);
        Object.entries(userCharts).forEach(([qid, chart]) => {
            console.log(`   📊 ${qid}: ${chart.type || chart.chartType} - "${chart.title || 'Untitled'}"}`);
        });
    } else {
        console.warn('⚠️ No charts saved yet');
        console.log('   Try creating a chart on question U1-L10-Q04');
    }

    // Test 4: Create a test chart
    console.log('\n4️⃣ Creating test chart...');
    const testChart = {
        type: 'histogram',
        chartType: 'histogram',
        title: 'Test Chart (Auto-generated)',
        xLabel: 'Categories',
        yLabel: 'Values',
        data: {
            bins: [
                { label: 'A', value: 10 },
                { label: 'B', value: 20 },
                { label: 'C', value: 15 }
            ],
            seriesName: 'Test Data'
        }
    };

    // Save test chart
    if (window.classData?.users?.[username]) {
        if (!window.classData.users[username].charts) {
            window.classData.users[username].charts = {};
        }
        window.classData.users[username].charts['TEST-001'] = testChart;

        if (typeof window.saveClassData === 'function') {
            window.saveClassData();
            console.log('✅ Test chart saved to localStorage');
            console.log('   Refresh page and run this test again to verify persistence');
        }
    }

    // Test 5: Verify localStorage
    console.log('\n5️⃣ Verifying localStorage...');
    const saved = JSON.parse(localStorage.getItem('classData') || '{}');
    const testChartSaved = saved.users?.[username]?.charts?.['TEST-001'];

    if (testChartSaved) {
        console.log('✅ Test chart found in localStorage');
    } else {
        console.warn('⚠️ Test chart not in localStorage yet');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('%cSUMMARY:', 'font-weight: bold; font-size: 14px');

    const allGood =
        typeof window.saveClassData === 'function' &&
        typeof window.openChartWizard === 'function';

    if (allGood) {
        console.log('%c✅ Chart system is ready!', 'color: green; font-weight: bold');
        console.log('\nNext steps:');
        console.log('1. Go to Unit 1, Lesson 10, Question 4');
        console.log('2. Click "Create Chart" button');
        console.log('3. Create and save a chart');
        console.log('4. Refresh the page');
        console.log('5. Return to the question - chart should be there!');
    } else {
        console.log('%c❌ Chart system has issues', 'color: red; font-weight: bold');
        console.log('Please refresh the page and try again');
    }

})();