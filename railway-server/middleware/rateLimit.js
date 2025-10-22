import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Redis client for distributed rate limiting (optional)
let redisClient = null;
if (process.env.REDIS_URL) {
    redisClient = createClient({
        url: process.env.REDIS_URL
    });

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        redisClient = null; // Fallback to memory store
    });

    redisClient.connect().catch(err => {
        console.error('Failed to connect to Redis:', err);
        redisClient = null;
    });
}

/**
 * Create rate limiter with specified options
 * Falls back to memory store if Redis is not available
 */
function createLimiter(options) {
    const baseConfig = {
        standardHeaders: true, // Return rate limit info in headers
        legacyHeaders: false,  // Disable X-RateLimit headers
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000)
            });
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/api/health';
        }
    };

    // Use Redis store if available, otherwise memory store
    if (redisClient) {
        return rateLimit({
            ...baseConfig,
            ...options,
            store: new RedisStore({
                client: redisClient,
                prefix: 'rl:',
            })
        });
    }

    return rateLimit({
        ...baseConfig,
        ...options
    });
}

/**
 * General API rate limiting
 * 100 requests per minute per IP
 */
export const general = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests from this IP'
});

/**
 * Strict rate limiting for profile creation
 * 5 profiles per hour per IP (prevent spam)
 */
export const createProfile = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many profile creation attempts',
    skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Authentication endpoints
 * 10 attempts per 15 minutes per IP
 */
export const auth = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many authentication attempts',
    skipSuccessfulRequests: true
});

/**
 * Write-heavy endpoints (answers, progress)
 * 30 requests per minute per user
 */
export const writeHeavy = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyGenerator: (req) => {
        // Rate limit by authenticated user, fallback to IP
        return req.user?.username || req.ip;
    },
    message: 'Too many write operations'
});

/**
 * Moderate write endpoints (votes)
 * 60 requests per minute per user
 */
export const writeModerate = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    keyGenerator: (req) => {
        return req.user?.username || req.ip;
    },
    message: 'Too many vote operations'
});

/**
 * Heartbeat/activity endpoints
 * 120 requests per minute per user (every 500ms allowed)
 */
export const heartbeat = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    keyGenerator: (req) => {
        return req.user?.username || req.ip;
    },
    message: 'Too many heartbeat requests'
});

/**
 * Data export endpoints
 * 10 requests per hour per user
 */
export const dataExport = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    keyGenerator: (req) => {
        return req.user?.username || req.ip;
    },
    message: 'Too many export requests'
});

/**
 * WebSocket connection rate limiting
 * 5 connections per minute per IP
 */
export const websocket = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many WebSocket connection attempts'
});

/**
 * Dynamic rate limiter based on user role
 * Teachers get higher limits
 */
export function dynamicRateLimit(req, res, next) {
    const isTeacher = req.user?.is_teacher || false;

    const limiter = createLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: isTeacher ? 200 : 100, // Teachers get 2x limit
        keyGenerator: (req) => {
            return req.user?.username || req.ip;
        }
    });

    return limiter(req, res, next);
}

/**
 * Sliding window rate limiter for more accurate limiting
 * Uses token bucket algorithm concept
 */
export class SlidingWindowLimiter {
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map(); // Store: key -> array of timestamps
    }

    check(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or create request array for this key
        let timestamps = this.requests.get(key) || [];

        // Remove old timestamps outside window
        timestamps = timestamps.filter(ts => ts > windowStart);

        // Check if limit exceeded
        if (timestamps.length >= this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: timestamps[0] + this.windowMs
            };
        }

        // Add current timestamp
        timestamps.push(now);
        this.requests.set(key, timestamps);

        // Cleanup old entries periodically
        if (Math.random() < 0.01) { // 1% chance
            this.cleanup();
        }

        return {
            allowed: true,
            remaining: this.maxRequests - timestamps.length,
            resetTime: now + this.windowMs
        };
    }

    cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        for (const [key, timestamps] of this.requests.entries()) {
            const filtered = timestamps.filter(ts => ts > windowStart);
            if (filtered.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, filtered);
            }
        }
    }
}

// Create sliding window limiters for critical endpoints
export const slidingWindow = {
    answer: new SlidingWindowLimiter(10, 60 * 1000), // 10 per minute
    vote: new SlidingWindowLimiter(30, 60 * 1000),   // 30 per minute
    profile: new SlidingWindowLimiter(2, 60 * 60 * 1000) // 2 per hour
};

/**
 * Middleware using sliding window limiter
 */
export function slidingWindowMiddleware(limiterName) {
    return (req, res, next) => {
        const limiter = slidingWindow[limiterName];
        if (!limiter) return next();

        const key = req.user?.username || req.ip;
        const result = limiter.check(key);

        // Set rate limit headers
        res.set({
            'X-RateLimit-Limit': limiter.maxRequests,
            'X-RateLimit-Remaining': result.remaining,
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
        });

        if (!result.allowed) {
            return res.status(429).json({
                error: 'Too many requests',
                message: 'Rate limit exceeded using sliding window',
                retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
            });
        }

        next();
    };
}

// Export rate limiters
export const rateLimiter = {
    general,
    createProfile,
    auth,
    writeHeavy,
    writeModerate,
    heartbeat,
    dataExport,
    websocket,
    dynamic: dynamicRateLimit,
    slidingWindow: slidingWindowMiddleware
};

export default rateLimiter;