/**
 * curriculum_config.js - Configuration for Curriculum Loader
 * Part of AP Statistics Consensus Quiz
 *
 * Controls whether to use async curriculum loading or traditional sync loading
 */

// Feature flag for lazy curriculum loading
// Set to false to disable async loading and use traditional sync method
window.USE_LAZY_CURRICULUM = true;

// Loader configuration (only used if USE_LAZY_CURRICULUM is true)
window.CURRICULUM_LOADER_CONFIG = {
    // URL to curriculum data file
    curriculumUrl: 'data/curriculum.js',

    // Cache time-to-live in milliseconds (30 minutes default)
    cacheTTL: 30 * 60 * 1000,

    // Maximum number of units to keep in memory cache
    maxMemoryUnits: 5,

    // Enable IndexedDB caching for faster subsequent loads
    enableIndexedDB: true,

    // Enable memory caching (should always be true for performance)
    enableMemoryCache: true,

    // Enable fallback to sync loading if async fails
    enableFallback: true
};

console.log('[CurriculumConfig] Lazy loading enabled:', window.USE_LAZY_CURRICULUM);
