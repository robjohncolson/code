import jwt from 'jsonwebtoken';

// JWT secret from environment or fallback for development
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Generate JWT token for a user
 *
 * @param {Object} payload - Token payload
 * @param {string} payload.username - User's username
 * @param {boolean} payload.is_teacher - Whether user is a teacher
 * @param {string} payload.class_section_id - User's class section UUID
 * @returns {string} JWT token
 */
export function generateToken(payload) {
    return jwt.sign(
        {
            username: payload.username,
            is_teacher: payload.is_teacher || false,
            class_section_id: payload.class_section_id || null,
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRY,
            issuer: 'apstats-quiz',
            audience: 'apstats-client'
        }
    );
}

/**
 * Verify and decode JWT token
 *
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'apstats-quiz',
            audience: 'apstats-client'
        });
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return null;
    }
}

/**
 * Refresh an existing valid token
 *
 * @param {string} token - Current valid JWT token
 * @returns {string|null} New JWT token or null if current token is invalid
 */
export function refreshToken(token) {
    const decoded = verifyToken(token);
    if (!decoded) return null;

    // Generate new token with same claims but fresh timestamp
    return generateToken({
        username: decoded.username,
        is_teacher: decoded.is_teacher,
        class_section_id: decoded.class_section_id
    });
}

/**
 * Middleware to authenticate JWT token (required)
 * Sets req.user with decoded token payload
 * Returns 401 if no valid token provided
 */
export function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'No authorization header provided'
        });
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Token is invalid or expired'
        });
    }

    // Attach user info to request
    req.user = {
        username: decoded.username,
        is_teacher: decoded.is_teacher || false,
        class_section_id: decoded.class_section_id || null,
        token_issued_at: decoded.iat
    };

    next();
}

/**
 * Middleware to optionally authenticate JWT token
 * Sets req.user if valid token provided, continues regardless
 */
export function optionalJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        req.user = null;
        return next();
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    const decoded = verifyToken(token);

    if (decoded) {
        req.user = {
            username: decoded.username,
            is_teacher: decoded.is_teacher || false,
            class_section_id: decoded.class_section_id || null,
            token_issued_at: decoded.iat
        };
    } else {
        req.user = null;
    }

    next();
}

/**
 * Middleware to require teacher role
 * Must be used after authenticateJWT
 */
export function requireTeacher(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Must be authenticated to access this resource'
        });
    }

    if (!req.user.is_teacher) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Teacher role required for this action'
        });
    }

    next();
}

/**
 * Middleware to check if user owns the resource
 * Compares req.params.username with authenticated user
 */
export function requireOwnership(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Must be authenticated to access this resource'
        });
    }

    const resourceUsername = req.params.username || req.body.username;

    if (req.user.username !== resourceUsername && !req.user.is_teacher) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only modify your own resources'
        });
    }

    next();
}

/**
 * Anonymous authentication flow
 * Creates a session-based token for anonymous users
 *
 * This supports the client-first, anonymous authentication model
 * where users have Fruit_Animal usernames without passwords
 */
export function createAnonymousSession(username, classCode = null) {
    // For anonymous users, we still generate a JWT but with limited claims
    // The username is the primary identifier (Fruit_Animal format)
    return generateToken({
        username: username,
        is_teacher: false,
        class_section_id: classCode
    });
}

/**
 * Middleware to set Supabase RLS context
 * Passes username to Supabase for RLS policy evaluation
 */
export function setSupabaseContext(req, res, next) {
    if (req.user && req.supabase) {
        // Set the username in Supabase context for RLS
        // This allows RLS policies to use current_setting('request.jwt.claims.username')
        req.supabaseContext = {
            username: req.user.username,
            is_teacher: req.user.is_teacher,
            class_section_id: req.user.class_section_id
        };
    }
    next();
}

// Export all functions
export default {
    generateToken,
    verifyToken,
    refreshToken,
    authenticateJWT,
    optionalJWT,
    requireTeacher,
    requireOwnership,
    createAnonymousSession,
    setSupabaseContext
};