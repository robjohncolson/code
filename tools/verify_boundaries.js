#!/usr/bin/env node
/**
 * Module Boundary Validation Script
 * Verifies architectural boundaries are maintained
 * See docs/module-boundaries.md for rules
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

let violations = [];
let warnings = [];

console.log(`${colors.blue}=== Module Boundary Validation ===${colors.reset}\n`);

// ============================================
// CHECK 1: No infrastructure calls in presentation layer
// ============================================
console.log('Checking presentation layer isolation...');

const presentationFiles = [
    'index.html',
    'js/charts.js',
    'css/styles.css'
];

const infrastructurePatterns = [
    { pattern: /supabase\.from\(/g, name: 'Direct Supabase call' },
    { pattern: /new WebSocket\(/g, name: 'Direct WebSocket creation' },
    { pattern: /SUPABASE_SERVICE_KEY/g, name: 'Service key reference' }
];

presentationFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
        warnings.push(`File not found: ${file}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    infrastructurePatterns.forEach(({ pattern, name }) => {
        if (pattern.test(content)) {
            violations.push({
                file,
                issue: `Presentation layer contains infrastructure code: ${name}`,
                severity: 'error'
            });
        }
    });
});

// ============================================
// CHECK 2: Script load order in index.html
// ============================================
console.log('Checking module load order...');

const indexHtmlPath = path.join(process.cwd(), 'index.html');
if (fs.existsSync(indexHtmlPath)) {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

    // Extract script tags
    const scriptMatches = [...indexHtml.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)];
    const scriptOrder = scriptMatches.map(m => m[1]);

    // Expected order (some may not exist yet)
    const expectedOrder = [
        'js/error_handler.js',      // Must be first
        'js/module_registry.js',    // Registry second
        'data/curriculum.js',       // Foundation data
        'data/units.js',
        'js/data_manager.js',       // Core business logic
        'js/auth.js',               // Depends on data_manager
        'js/charts.js'              // Presentation
    ];

    // Check error_handler.js is first (if it exists)
    const errorHandlerIndex = scriptOrder.findIndex(s => s.includes('error_handler.js'));
    if (errorHandlerIndex > 0) {
        violations.push({
            file: 'index.html',
            issue: 'error_handler.js must be first script loaded',
            severity: 'error'
        });
    }

    // Check data_manager.js loads before auth.js
    const dataManagerIndex = scriptOrder.findIndex(s => s.includes('data_manager.js'));
    const authIndex = scriptOrder.findIndex(s => s.includes('auth.js'));

    if (dataManagerIndex > -1 && authIndex > -1 && dataManagerIndex > authIndex) {
        violations.push({
            file: 'index.html',
            issue: 'auth.js loads before data_manager.js (dependency violation)',
            severity: 'error'
        });
    }

    console.log(`  Found ${scriptOrder.length} script tags`);
}

// ============================================
// CHECK 3: No circular dependencies
// ============================================
console.log('Checking for circular dependencies...');

const modules = {
    'js/data_manager.js': [],                           // No dependencies
    'js/auth.js': ['js/data_manager.js'],              // Depends on data_manager
    'js/charts.js': [],                                 // Independent
    'railway_client.js': ['js/data_manager.js']        // Patches data_manager
};

// Simple cycle detection (exhaustive for small graph)
function hasCycle(graph) {
    const visited = new Set();
    const recStack = new Set();

    function visit(node, path = []) {
        if (recStack.has(node)) {
            violations.push({
                file: node,
                issue: `Circular dependency detected: ${path.join(' -> ')} -> ${node}`,
                severity: 'error'
            });
            return true;
        }

        if (visited.has(node)) return false;

        visited.add(node);
        recStack.add(node);

        const deps = graph[node] || [];
        for (const dep of deps) {
            visit(dep, [...path, node]);
        }

        recStack.delete(node);
        return false;
    }

    Object.keys(graph).forEach(node => visit(node));
}

hasCycle(modules);

// ============================================
// CHECK 4: No PII in console.log statements
// ============================================
console.log('Checking for PII in log statements...');

const jsFiles = [
    'js/auth.js',
    'js/data_manager.js',
    'js/charts.js'
];

const piiPatterns = [
    { pattern: /console\.log\([^)]*@[^)]*\)/g, name: 'Email pattern in console.log' },
    { pattern: /console\.log\([^)]*\d{3}-\d{2}-\d{4}/g, name: 'SSN pattern in console' }
];

jsFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');

    piiPatterns.forEach(({ pattern, name }) => {
        const matches = content.match(pattern);
        if (matches) {
            warnings.push({
                file,
                issue: `Potential PII in logging: ${name}`,
                severity: 'warning'
            });
        }
    });
});

// ============================================
// CHECK 5: Secrets not in source code
// ============================================
console.log('Checking for hardcoded secrets...');

const allFiles = [
    'index.html',
    'js/auth.js',
    'js/data_manager.js',
    'supabase_config.js',
    'railway_config.js'
];

const secretPatterns = [
    { pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, name: 'JWT token' },
    { pattern: /sk_live_[A-Za-z0-9]+/g, name: 'Stripe secret key' },
    { pattern: /SUPABASE_SERVICE_KEY\s*=\s*["'][^"']+["']/g, name: 'Hardcoded service key' }
];

allFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');

    // Allow SUPABASE_ANON_KEY (public key is safe)
    secretPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(content) && !file.includes('.env')) {
            violations.push({
                file,
                issue: `Hardcoded secret detected: ${name}`,
                severity: 'error'
            });
        }
    });
});

// ============================================
// REPORT RESULTS
// ============================================
console.log('\n' + '='.repeat(50));

if (violations.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✓ All boundary checks passed!${colors.reset}`);
    process.exit(0);
}

if (warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠ Warnings (${warnings.length}):${colors.reset}`);
    warnings.forEach(w => {
        console.log(`  ${colors.yellow}▸${colors.reset} ${w.file}: ${w.issue}`);
    });
}

if (violations.length > 0) {
    console.log(`\n${colors.red}✗ Violations (${violations.length}):${colors.reset}`);
    violations.forEach(v => {
        console.log(`  ${colors.red}✗${colors.reset} ${v.file}: ${v.issue}`);
    });
    console.log(`\n${colors.red}Fix violations and run again.${colors.reset}\n`);
    process.exit(1);
}

console.log('');
process.exit(0);
