// Authentication Validator - Username validation and PII detection
// Part of AP Statistics Consensus Quiz
// See docs/security/auth-flow.md for authentication model

(function() {
    'use strict';

    window.AuthValidator = {
        /**
         * Validate username format (no PII patterns)
         * @param {string} username - Username to validate
         * @returns {boolean} True if valid, false otherwise
         */
        isValidUsername: function(username) {
            if (!username || typeof username !== 'string') {
                return false;
            }

            // Minimum length (prevent too short)
            if (username.length < 3) {
                return false;
            }

            // Maximum length (reasonable limit)
            if (username.length > 30) {
                return false;
            }

            // Block email-like patterns (contains @)
            if (username.includes('@')) {
                return false;
            }

            // Block phone-like patterns (10+ digits)
            const digitCount = username.replace(/\D/g, '').length;
            if (digitCount >= 10) {
                return false;
            }

            // Block name-like patterns (First Last)
            if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(username)) {
                return false;
            }

            // Block SSN-like patterns
            if (/\d{3}-\d{2}-\d{4}/.test(username)) {
                return false;
            }

            // Allow only alphanumeric and underscore
            if (!/^[A-Za-z0-9_]+$/.test(username)) {
                return false;
            }

            return true;
        },

        /**
         * Check for PII (Personally Identifiable Information) patterns
         * Used for validating user input (answers, reasons, etc.)
         * @param {string} text - Text to check
         * @returns {boolean} True if PII detected, false otherwise
         */
        containsPII: function(text) {
            if (!text || typeof text !== 'string') {
                return false;
            }

            const patterns = [
                // Full names (First Last)
                /\b[A-Z][a-z]+ [A-Z][a-z]+\b/,

                // Email addresses
                /\S+@\S+\.\S+/,

                // SSN (xxx-xx-xxxx)
                /\b\d{3}-\d{2}-\d{4}\b/,

                // Phone numbers (various formats)
                /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
                /\(\d{3}\)\s*\d{3}[-.]?\d{4}/,

                // Credit card-like (16 digits)
                /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,

                // Street addresses (number + street name)
                /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln)\b/i
            ];

            return patterns.some(pattern => pattern.test(text));
        },

        /**
         * Generate random anonymous username (Fruit_Animal format)
         * @returns {string} Generated username
         */
        generateUsername: function() {
            const fruits = [
                'Apple', 'Banana', 'Cherry', 'Mango', 'Orange',
                'Peach', 'Grape', 'Kiwi', 'Lemon', 'Melon',
                'Pear', 'Plum', 'Berry', 'Fig', 'Date'
            ];

            const animals = [
                'Penguin', 'Koala', 'Panda', 'Dolphin', 'Tiger',
                'Bear', 'Fox', 'Owl', 'Eagle', 'Hawk',
                'Seal', 'Otter', 'Rabbit', 'Deer', 'Wolf'
            ];

            const fruit = fruits[Math.floor(Math.random() * fruits.length)];
            const animal = animals[Math.floor(Math.random() * animals.length)];

            return `${fruit}_${animal}`;
        },

        /**
         * Suggest corrections for invalid usernames
         * @param {string} username - Invalid username
         * @returns {object} Suggestion object {valid: boolean, suggestion: string, reason: string}
         */
        suggestCorrection: function(username) {
            if (!username) {
                return {
                    valid: false,
                    suggestion: this.generateUsername(),
                    reason: 'Username cannot be empty'
                };
            }

            if (username.length < 3) {
                return {
                    valid: false,
                    suggestion: username + '_User',
                    reason: 'Username too short (minimum 3 characters)'
                };
            }

            if (username.includes('@')) {
                return {
                    valid: false,
                    suggestion: username.split('@')[0].replace(/[^A-Za-z0-9_]/g, '_'),
                    reason: 'Email addresses not allowed (privacy protection)'
                };
            }

            if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(username)) {
                return {
                    valid: false,
                    suggestion: username.replace(/\s+/g, '_'),
                    reason: 'Real names not allowed (privacy protection)'
                };
            }

            if (!/^[A-Za-z0-9_]+$/.test(username)) {
                return {
                    valid: false,
                    suggestion: username.replace(/[^A-Za-z0-9_]/g, '_'),
                    reason: 'Only letters, numbers, and underscores allowed'
                };
            }

            // If we get here, username should be valid
            return {
                valid: true,
                suggestion: username,
                reason: 'Username is valid'
            };
        },

        /**
         * Sanitize text for safe display (remove potential PII)
         * @param {string} text - Text to sanitize
         * @returns {string} Sanitized text
         */
        sanitizeText: function(text) {
            if (!text || typeof text !== 'string') {
                return '';
            }

            let sanitized = text;

            // Redact email addresses
            sanitized = sanitized.replace(/\S+@\S+\.\S+/g, '[EMAIL REMOVED]');

            // Redact phone numbers
            sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REMOVED]');
            sanitized = sanitized.replace(/\(\d{3}\)\s*\d{3}[-.]?\d{4}/g, '[PHONE REMOVED]');

            // Redact SSN
            sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REMOVED]');

            // Redact credit card numbers
            sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD REMOVED]');

            return sanitized;
        },

        /**
         * Validate student mapping CSV data (for teacher import)
         * Ensures no PII exposed in logs
         * @param {string} csvContent - CSV file content
         * @returns {object} Validation result {valid: boolean, errors: array}
         */
        validateStudentCSV: function(csvContent) {
            const errors = [];

            if (!csvContent) {
                return { valid: false, errors: ['CSV content is empty'] };
            }

            const lines = csvContent.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                return { valid: false, errors: ['No data in CSV'] };
            }

            // Check each line (skip header if exists)
            const startIdx = lines[0].toLowerCase().includes('name') ? 1 : 0;

            for (let i = startIdx; i < lines.length; i++) {
                const line = lines[i];
                const parts = line.split(',').map(p => p.trim());

                if (parts.length < 2) {
                    errors.push(`Line ${i + 1}: Invalid format (expected: Name, Username)`);
                    continue;
                }

                const [realName, username] = parts;

                // Validate username (second column)
                if (!this.isValidUsername(username)) {
                    errors.push(`Line ${i + 1}: Invalid username "${username}"`);
                }

                // Warn if real name appears to contain PII
                if (this.containsPII(realName)) {
                    // This is expected (real names in first column)
                    // Just verify it's not accidentally in username column
                    if (this.containsPII(username)) {
                        errors.push(`Line ${i + 1}: Username contains PII "${username}"`);
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors: errors,
                rowCount: lines.length - startIdx
            };
        }
    };

    // Register module
    if (window.MODULE_REGISTRY) {
        window.MODULE_REGISTRY.register('auth_validator');
    }

})();
