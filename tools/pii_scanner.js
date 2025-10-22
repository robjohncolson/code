#!/usr/bin/env node
/**
 * PII Scanner - Detect potential PII in logging statements
 * Scans JavaScript files for console.log calls that may contain PII
 * See docs/security/logging-policy.md for policy
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

console.log(`${colors.blue}=== PII Scanner ===${colors.reset}\n`);

let violations = [];
let warnings = [];

// ============================================
// PII PATTERNS TO DETECT
// ============================================

const piiPatterns = [
    // Email in console.log
    {
        pattern: /console\.(log|error|warn|info)\([^)]*@[^)]*\)/g,
        name: 'Email pattern in console statement',
        severity: 'error',
        example: 'console.log("user@email.com")'
    },

    // SSN pattern in console
    {
        pattern: /console\.(log|error|warn|info)\([^)]*\d{3}-\d{2}-\d{4}/g,
        name: 'SSN pattern in console statement',
        severity: 'error',
        example: 'console.log("123-45-6789")'
    },

    // Name-like pattern in console
    {
        pattern: /console\.(log|error|warn|info)\([^)]*["'][A-Z][a-z]+ [A-Z][a-z]+["']/g,
        name: 'Name pattern in console statement',
        severity: 'warning',
        example: 'console.log("John Smith")'
    },

    // Phone number in console
    {
        pattern: /console\.(log|error|warn|info)\([^)]*\d{3}[-.]?\d{3}[-.]?\d{4}/g,
        name: 'Phone pattern in console statement',
        severity: 'error',
        example: 'console.log("555-1234")'
    },

    // Email in localStorage
    {
        pattern: /localStorage\.setItem\([^,]*, [^)]*@[^)]*\)/g,
        name: 'Email pattern in localStorage',
        severity: 'error',
        example: 'localStorage.setItem("key", "user@email.com")'
    },

    // Real name variable usage (heuristic)
    {
        pattern: /console\.(log|error|warn|info)\([^)]*student(Name|Email|Phone)/gi,
        name: 'Student PII variable in console',
        severity: 'warning',
        example: 'console.log(studentName)'
    },

    // CSV data logging (critical)
    {
        pattern: /console\.(log|error|warn|info)\([^)]*csvData[^)]*\)/gi,
        name: 'CSV data (may contain PII) in console',
        severity: 'error',
        example: 'console.log(csvData)'
    }
];

// ============================================
// SAFE PATTERNS (ALLOWED)
// ============================================

const safePatterns = [
    /console\.(log|error|warn|info)\([^)]*SafeLogger/,  // Using SafeLogger
    /console\.(log|error|warn|info)\([^)]*\[EMAIL\]/,   // Already redacted
    /console\.(log|error|warn|info)\([^)]*\[NAME\]/,    // Already redacted
    /console\.(log|error|warn|info)\([^)]*username/i,   // Anonymous username (allowed)
    /console\.(log|error|warn|info)\([^)]*questionId/i  // Question IDs (allowed)
];

// ============================================
// FILES TO SCAN
// ============================================

const filesToScan = [
    'js/auth.js',
    'js/data_manager.js',
    'js/charts.js',
    'js/auth_validator.js',
    'js/safe_logger.js',
    'index.html',
    'railway_client.js',
    'railway-server/server.js'
];

// ============================================
// SCAN FUNCTION
// ============================================

function scanFile(filepath) {
    if (!fs.existsSync(filepath)) {
        warnings.push({
            file: filepath,
            issue: 'File not found (skipped)',
            severity: 'warning'
        });
        return;
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');

    piiPatterns.forEach(({ pattern, name, severity, example }) => {
        // Reset regex state
        pattern.lastIndex = 0;

        lines.forEach((line, lineNum) => {
            // Skip comments
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
                return;
            }

            // Check if line matches PII pattern
            if (pattern.test(line)) {
                // Check if it's a safe pattern
                const isSafe = safePatterns.some(safe => safe.test(line));

                if (!isSafe) {
                    const finding = {
                        file: filepath,
                        line: lineNum + 1,
                        issue: name,
                        severity: severity,
                        code: line.trim().substring(0, 80),
                        example: example
                    };

                    if (severity === 'error') {
                        violations.push(finding);
                    } else {
                        warnings.push(finding);
                    }
                }
            }

            // Reset for next iteration
            pattern.lastIndex = 0;
        });
    });
}

// ============================================
// SPECIAL CHECK: CSV HANDLING
// ============================================

function checkCSVHandling() {
    const indexHtml = path.join(process.cwd(), 'index.html');

    if (!fs.existsSync(indexHtml)) return;

    const content = fs.readFileSync(indexHtml, 'utf8');

    // Check if CSV processing logs the actual CSV data
    if (/csvMappingData.*console\.log/i.test(content)) {
        violations.push({
            file: 'index.html',
            issue: 'CSV mapping data logged to console (contains real names)',
            severity: 'error',
            code: 'csvMappingData logged'
        });
    }

    // Check if student names are logged
    if (/realName.*console\.log/i.test(content)) {
        violations.push({
            file: 'index.html',
            issue: 'Real student names logged to console',
            severity: 'error',
            code: 'realName logged'
        });
    }
}

// ============================================
// RUN SCANS
// ============================================

console.log(`Scanning ${filesToScan.length} files for PII patterns...\n`);

filesToScan.forEach(file => {
    const filepath = path.join(process.cwd(), file);
    scanFile(filepath);
});

checkCSVHandling();

// ============================================
// REPORT RESULTS
// ============================================

console.log('='.repeat(60));

if (violations.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✓ No PII logging violations found!${colors.reset}\n`);
    process.exit(0);
}

if (warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠ Warnings (${warnings.length}):${colors.reset}`);
    warnings.forEach(w => {
        console.log(`\n  ${colors.yellow}▸${colors.reset} ${w.file}${w.line ? ':' + w.line : ''}`);
        console.log(`    Issue: ${w.issue}`);
        if (w.code) {
            console.log(`    Code: ${colors.yellow}${w.code}${colors.reset}`);
        }
        if (w.example) {
            console.log(`    Example violation: ${w.example}`);
        }
    });
}

if (violations.length > 0) {
    console.log(`\n${colors.red}✗ Violations (${violations.length}):${colors.reset}`);
    violations.forEach(v => {
        console.log(`\n  ${colors.red}✗${colors.reset} ${v.file}:${v.line}`);
        console.log(`    Issue: ${v.issue}`);
        console.log(`    Code: ${colors.red}${v.code}${colors.reset}`);
        if (v.example) {
            console.log(`    Example violation: ${v.example}`);
        }
        console.log(`    Fix: Use SafeLogger.event() or ensure SafeLogger sanitizes`);
    });

    console.log(`\n${colors.red}Fix violations before deploying.${colors.reset}`);
    console.log(`See docs/security/logging-policy.md for guidance.\n`);
    process.exit(1);
}

// Only warnings, no violations
console.log(`\n${colors.yellow}Review warnings before deploying.${colors.reset}\n`);
process.exit(0);
