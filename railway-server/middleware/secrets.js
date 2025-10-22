/**
 * Secrets Validation Middleware
 * Validates environment variables on Railway server startup
 * Prevents server from running with missing or invalid secrets
 */

/**
 * Validate required environment variables exist and are properly formatted
 * Exits process with error if validation fails
 */
export function validateSecrets() {
    console.log('🔒 Validating secrets...');

    // Required environment variables
    const required = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY'
    ];

    // Check for missing variables
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing);
        console.error('\nSet these in Railway dashboard or local .env file');
        console.error('See docs/security/secrets-guide.md for instructions');
        process.exit(1);
    }

    // Validate SUPABASE_URL format
    if (!process.env.SUPABASE_URL.startsWith('https://')) {
        console.error('❌ SUPABASE_URL must use HTTPS protocol');
        console.error('   Got:', process.env.SUPABASE_URL);
        process.exit(1);
    }

    // Validate SUPABASE_URL is a valid URL
    try {
        new URL(process.env.SUPABASE_URL);
    } catch (error) {
        console.error('❌ SUPABASE_URL is not a valid URL');
        console.error('   Got:', process.env.SUPABASE_URL);
        process.exit(1);
    }

    // Validate JWT token format (basic check)
    const jwtPattern = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

    if (!jwtPattern.test(process.env.SUPABASE_ANON_KEY)) {
        console.error('❌ SUPABASE_ANON_KEY appears invalid (not a JWT token)');
        console.error('   Expected format: eyJ...  (JWT token)');
        process.exit(1);
    }

    // Optional: Validate service key if provided
    if (process.env.SUPABASE_SERVICE_KEY) {
        if (!jwtPattern.test(process.env.SUPABASE_SERVICE_KEY)) {
            console.error('❌ SUPABASE_SERVICE_KEY appears invalid (not a JWT token)');
            process.exit(1);
        }
        console.log('✓ Service key detected (server has elevated permissions)');
    }

    // Log configuration (NOT secrets)
    const env = process.env.NODE_ENV || 'development';
    console.log('\n📋 Configuration:');
    console.log('   Environment:', env);
    console.log('   Supabase URL:', process.env.SUPABASE_URL);
    console.log('   Anon key loaded: ✓');
    console.log('   Service key loaded:', process.env.SUPABASE_SERVICE_KEY ? '✓' : '✗ (using anon key only)');
    console.log('   Port:', process.env.PORT || 3000);
    console.log('   CORS origins:', process.env.ALLOWED_ORIGINS || 'Not configured (allow all)');

    console.log('\n✓ All secrets validated successfully\n');
}

/**
 * Sanitize HTTP headers for safe logging
 * Removes sensitive headers (authorization, cookies, etc.)
 * @param {object} headers - Request headers object
 * @returns {object} Sanitized headers
 */
export function sanitizeHeaders(headers) {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
        'apikey'
    ];

    sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
    });

    return sanitized;
}

/**
 * Sanitize request body for logging (removes potential secrets)
 * @param {object} body - Request body object
 * @returns {object} Sanitized body
 */
export function sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const sanitized = { ...body };

    // Keys that might contain secrets
    const secretKeys = [
        'password',
        'secret',
        'token',
        'api_key',
        'apiKey',
        'apikey',
        'private_key',
        'privateKey'
    ];

    secretKeys.forEach(key => {
        if (sanitized[key]) {
            sanitized[key] = '[REDACTED]';
        }
    });

    return sanitized;
}

/**
 * Safe error logger - logs errors without exposing secrets
 * @param {Error} error - Error object
 * @param {object} context - Additional context (will be sanitized)
 */
export function logError(error, context = {}) {
    console.error('❌ Error:', error.message);

    // Log stack trace in development only
    if (process.env.NODE_ENV !== 'production') {
        console.error('Stack:', error.stack);
    }

    // Sanitize and log context
    const sanitizedContext = {
        ...context,
        headers: context.headers ? sanitizeHeaders(context.headers) : undefined,
        body: context.body ? sanitizeBody(context.body) : undefined
    };

    console.error('Context:', JSON.stringify(sanitizedContext, null, 2));
}

/**
 * Express middleware to validate requests don't contain leaked secrets
 * WARNING: This is a detection mechanism, not prevention
 */
export function secretLeakDetector(req, res, next) {
    // Check if request body contains patterns that look like secrets
    if (req.body && typeof req.body === 'object') {
        const bodyStr = JSON.stringify(req.body);

        // Detect JWT tokens in body (shouldn't be there)
        const jwtPattern = /eyJ[A-Za-z0-9_-]{20,}/g;
        if (jwtPattern.test(bodyStr)) {
            console.warn('⚠️ WARNING: JWT token detected in request body');
            console.warn('   Endpoint:', req.path);
            console.warn('   This may be a secret leak!');
        }

        // Detect Supabase service key pattern
        if (bodyStr.includes('service_role')) {
            console.error('❌ CRITICAL: Supabase service key pattern in request!');
            console.error('   Endpoint:', req.path);
            console.error('   Request rejected for security');

            return res.status(400).json({
                error: 'Invalid request - potential secret leak detected'
            });
        }
    }

    next();
}
