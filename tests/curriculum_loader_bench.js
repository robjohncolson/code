/**
 * curriculum_loader_bench.js - Performance Benchmarks for Curriculum Loader
 * Part of AP Statistics Consensus Quiz
 *
 * Comprehensive performance testing for curriculum loading system
 * Run in browser console: await runCurriculumBenchmarks()
 */

async function runCurriculumBenchmarks() {
    console.log('='.repeat(80));
    console.log('🧪 Curriculum Loader Performance Benchmarks');
    console.log('='.repeat(80));
    console.log('');

    const results = {
        passed: 0,
        failed: 0,
        benchmarks: []
    };

    /**
     * Helper to run benchmark
     */
    async function runBenchmark(name, testFn, targetMs = null) {
        console.log(`\n▶️  Benchmark: ${name}`);

        try {
            const startMark = `bench-${name}-start`;
            const endMark = `bench-${name}-end`;

            performance.mark(startMark);
            const result = await testFn();
            performance.mark(endMark);

            performance.measure(`bench-${name}`, startMark, endMark);
            const measure = performance.getEntriesByName(`bench-${name}`)[0];
            const duration = measure.duration;

            const status = targetMs ? (duration <= targetMs ? 'PASS' : 'FAIL') : 'INFO';
            const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';

            console.log(`${emoji} ${name}: ${duration.toFixed(2)}ms`);
            if (targetMs) {
                console.log(`   Target: ${targetMs}ms`);
            }
            if (result) {
                console.log(`   Result:`, result);
            }

            if (status === 'PASS' || status === 'INFO') {
                results.passed++;
            } else {
                results.failed++;
            }

            results.benchmarks.push({
                name,
                duration: duration.toFixed(2),
                target: targetMs,
                status,
                result
            });

        } catch (error) {
            console.error(`❌ ${name}: FAILED`);
            console.error('   Error:', error.message);
            results.failed++;
            results.benchmarks.push({
                name,
                status: 'FAIL',
                error: error.message
            });
        }
    }

    // ==========================================
    // Benchmark 1: Cold Start - Initial Load
    // ==========================================
    await runBenchmark('Cold Start - Initial Loader Creation', async () => {
        const loader = new CurriculumLoader({
            curriculumUrl: 'data/curriculum.js',
            enableIndexedDB: false, // Disable cache for cold test
            enableMemoryCache: true
        });

        return `Loader created`;
    }, 10); // Target: < 10ms

    // ==========================================
    // Benchmark 2: First Unit Load (Cold)
    // ==========================================
    await runBenchmark('First Unit Load (Cold Cache)', async () => {
        // Clear all caches first
        if (window.curriculumLoader) {
            await window.curriculumLoader.clearCache();
        }

        // Create fresh loader
        const loader = new CurriculumLoader({
            curriculumUrl: 'data/curriculum.js',
            enableIndexedDB: false
        });

        await loader.init();
        const unit = await loader.loadUnit(1);

        return `Loaded ${unit.questions.length} questions`;
    }, 200); // Target: < 200ms

    // ==========================================
    // Benchmark 3: Subsequent Unit Load (Warm)
    // ==========================================
    await runBenchmark('Subsequent Unit Load (Warm Cache)', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        const unit = await window.curriculumLoader.loadUnit(2);
        return `Loaded ${unit.questions.length} questions`;
    }, 5); // Target: < 5ms

    // ==========================================
    // Benchmark 4: Question Lookup by ID
    // ==========================================
    await runBenchmark('Question Lookup (O(1))', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        const question = await window.curriculumLoader.getQuestion('U1-L2-Q01');
        return question ? `Found: ${question.id}` : 'Not found';
    }, 1); // Target: < 1ms

    // ==========================================
    // Benchmark 5: Index Generation
    // ==========================================
    await runBenchmark('Index Generation (Full Curriculum)', async () => {
        const index = new CurriculumIndex();

        // Get curriculum data
        const curriculum = window.curriculumLoader.fullCurriculum ||
                          EMBEDDED_CURRICULUM;

        await index.buildIndex(curriculum);

        const stats = index.getStats();
        return `Indexed ${stats.totalQuestions} questions, ${stats.totalUnits} units`;
    }, 100); // Target: < 100ms

    // ==========================================
    // Benchmark 6: Text Search Query
    // ==========================================
    await runBenchmark('Text Search (Substring)', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        const results = await window.curriculumLoader.searchQuestions('categorical variable');
        return `Found ${results.length} matches`;
    }, 50); // Target: < 50ms

    // ==========================================
    // Benchmark 7: Unit Questions Retrieval
    // ==========================================
    await runBenchmark('Get Unit Questions', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        const questions = await window.curriculumLoader.getUnitQuestions(3);
        return `Retrieved ${questions.length} questions`;
    }, 10); // Target: < 10ms

    // ==========================================
    // Benchmark 8: Memory Usage Check
    // ==========================================
    await runBenchmark('Memory Footprint', async () => {
        if (typeof performance.memory === 'undefined') {
            return 'Performance.memory not available (Chrome only)';
        }

        const memory = performance.memory;
        const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);

        return `Used: ${usedMB}MB / Limit: ${limitMB}MB`;
    }, null); // Info only, no target

    // ==========================================
    // Benchmark 9: Cache Hit Rate
    // ==========================================
    await runBenchmark('Cache Hit Rate', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        // Load several units
        await window.curriculumLoader.loadUnit(1);
        await window.curriculumLoader.loadUnit(2);
        await window.curriculumLoader.loadUnit(3);
        await window.curriculumLoader.loadUnit(1); // Should hit cache
        await window.curriculumLoader.loadUnit(2); // Should hit cache

        const metrics = window.curriculumLoader.getMetrics();
        const hitRate = (metrics.cacheHitRate * 100).toFixed(1);

        return `Hit rate: ${hitRate}%, Hits: ${metrics.cacheHits}, Misses: ${metrics.cacheMisses}`;
    }, null); // Info only

    // ==========================================
    // Benchmark 10: Preload Performance
    // ==========================================
    await runBenchmark('Preload Adjacent Units', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        // Trigger preload
        await window.curriculumLoader.preloadAdjacentUnits(4);

        // Wait a bit for preload to start
        await new Promise(resolve => setTimeout(resolve, 500));

        const preloadStats = window.curriculumLoader.getPreloadStats();
        return `Queue: ${preloadStats.queueLength}, Network: ${preloadStats.networkType}`;
    }, null); // Info only

    // ==========================================
    // Benchmark 11: IndexedDB Cache Performance
    // ==========================================
    await runBenchmark('IndexedDB Cache Save/Load', async () => {
        const testLoader = new CurriculumLoader({
            enableIndexedDB: true
        });

        await testLoader.init();

        // Save should happen automatically during init
        // Now create a new loader and load from cache
        const cachedLoader = new CurriculumLoader({
            enableIndexedDB: true
        });

        const loadedFromCache = await cachedLoader.init();

        return loadedFromCache ? 'Cache hit' : 'Cache miss';
    }, null); // Info only

    // ==========================================
    // Stress Test: Rapid Random Queries
    // ==========================================
    await runBenchmark('Stress Test: 100 Random Queries', async () => {
        if (!window.curriculumLoader) {
            throw new Error('Loader not initialized');
        }

        const queries = [
            'mean', 'median', 'standard deviation', 'variance',
            'categorical', 'quantitative', 'distribution', 'sample',
            'population', 'hypothesis'
        ];

        let totalMatches = 0;

        for (let i = 0; i < 100; i++) {
            const query = queries[Math.floor(Math.random() * queries.length)];
            const results = await window.curriculumLoader.searchQuestions(query, { limit: 10 });
            totalMatches += results.length;
        }

        return `100 queries completed, ${totalMatches} total matches`;
    }, null); // Info only

    // ==========================================
    // Results Summary
    // ==========================================
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 Benchmark Results Summary');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📝 Total:  ${results.passed + results.failed}`);
    console.log('');

    if (results.failed > 0) {
        console.log('❌ Failed Benchmarks:');
        results.benchmarks
            .filter(b => b.status === 'FAIL')
            .forEach(b => {
                console.log(`   • ${b.name}: ${b.duration}ms (target: ${b.target}ms)`);
            });
        console.log('');
    }

    const successRate = (results.passed / (results.passed + results.failed) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);
    console.log('');

    // Performance Summary
    console.log('Performance Targets:');
    console.log('  ✓ Cold start: < 10ms');
    console.log('  ✓ First unit load: < 200ms');
    console.log('  ✓ Warm unit load: < 5ms');
    console.log('  ✓ Question lookup: < 1ms');
    console.log('  ✓ Index generation: < 100ms');
    console.log('  ✓ Text search: < 50ms');
    console.log('');

    if (results.failed === 0) {
        console.log('🎉 All benchmarks passed!');
    } else {
        console.log('⚠️  Some benchmarks failed. Review results above.');
    }

    console.log('='.repeat(80));

    return results;
}

// Auto-run if loaded with ?run-benchmarks query param
if (typeof window !== 'undefined' && window.location.search.includes('run-benchmarks')) {
    window.addEventListener('load', () => {
        setTimeout(() => runCurriculumBenchmarks(), 2000);
    });
}

// Export for manual running
window.runCurriculumBenchmarks = runCurriculumBenchmarks;

console.log('✨ Curriculum loader benchmarks loaded.');
console.log('💡 Run runCurriculumBenchmarks() in console to start.');
