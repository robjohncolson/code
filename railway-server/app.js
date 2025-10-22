/**
 * Express Application Configuration
 * Separated from server.js for testing purposes
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import rateLimiter from './middleware/rateLimit.js';
import { requestLogging, errorLogging } from './middleware/logging.js';

// Import logger
import logger from './lib/logger.js';

// Import health checker
import healthChecker, { databaseCheck, cacheCheck } from './lib/health.js';

// Import routes
import apiRoutes from './routes/api.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// ============================================
// Global Middleware
// ============================================

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// P11: Structured request logging with PII redaction
app.use(requestLogging);

// Initialize Supabase client
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }
);

// Attach Supabase to requests for controllers
app.use((req, res, next) => {
    req.supabase = supabase;
    next();
});

// ============================================
// Routes
// ============================================

// P11: Comprehensive health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Register health checks
        healthChecker.registerCheck('database', () => databaseCheck(supabase), 1000);
        healthChecker.registerCheck('cache', () => Promise.resolve(cacheCheck(cache)), 100);

        // Run all checks
        const health = await healthChecker.runChecks();

        // Return appropriate status code
        const statusCode = health.status === 'unhealthy' ? 503 : 200;

        res.status(statusCode).json(health);
    } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});

// Metrics endpoint (similar to Prometheus format)
app.get('/metrics', (req, res) => {
    const metrics = healthChecker.getMetrics();

    res.json({
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        ...metrics
    });
});

// API routes with rate limiting
app.use('/api', apiRoutes);

// ============================================
// Legacy Endpoints (Backward Compatibility)
// ============================================

// In-memory cache for legacy endpoints
const cache = {
    peerData: null,
    questionStats: new Map(),
    lastUpdate: 0,
    TTL: 30000 // 30 seconds
};

function isCacheValid(lastUpdate, ttl = cache.TTL) {
    return Date.now() - lastUpdate < ttl;
}

function normalizeTimestamp(timestamp) {
    if (typeof timestamp === 'string') {
        return new Date(timestamp).getTime();
    }
    return timestamp;
}

// Legacy: Get all peer data
app.get('/api/peer-data', rateLimiter.general, async (req, res, next) => {
    try {
        const since = req.query.since ? parseInt(req.query.since) : 0;

        if (isCacheValid(cache.lastUpdate) && cache.peerData) {
            const filteredData = since > 0
                ? cache.peerData.filter(a => a.timestamp > since)
                : cache.peerData;

            return res.json({
                data: filteredData,
                total: cache.peerData.length,
                filtered: filteredData.length,
                cached: true,
                lastUpdate: cache.lastUpdate
            });
        }

        const { data, error } = await supabase
            .from('answers')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        const normalizedData = data.map(answer => ({
            ...answer,
            timestamp: normalizeTimestamp(answer.timestamp)
        }));

        cache.peerData = normalizedData;
        cache.lastUpdate = Date.now();

        const filteredData = since > 0
            ? normalizedData.filter(a => a.timestamp > since)
            : normalizedData;

        res.json({
            data: filteredData,
            total: normalizedData.length,
            filtered: filteredData.length,
            cached: false,
            lastUpdate: cache.lastUpdate
        });

    } catch (error) {
        next(error);
    }
});

// Legacy: Get question statistics
app.get('/api/question-stats/:questionId', rateLimiter.general, async (req, res, next) => {
    try {
        const { questionId } = req.params;

        const cached = cache.questionStats.get(questionId);
        if (cached && isCacheValid(cached.timestamp, 60000)) {
            return res.json(cached.data);
        }

        const { data, error } = await supabase
            .from('answers')
            .select('answer_value, username')
            .eq('question_id', questionId);

        if (error) throw error;

        const distribution = {};
        const users = new Set();

        data.forEach(answer => {
            distribution[answer.answer_value] = (distribution[answer.answer_value] || 0) + 1;
            users.add(answer.username);
        });

        let consensus = null;
        let maxCount = 0;
        Object.entries(distribution).forEach(([value, count]) => {
            if (count > maxCount) {
                maxCount = count;
                consensus = value;
            }
        });

        const total = data.length;
        const percentages = {};
        Object.entries(distribution).forEach(([value, count]) => {
            percentages[value] = Math.round((count / total) * 100);
        });

        const stats = {
            questionId,
            consensus,
            distribution: percentages,
            totalResponses: total,
            uniqueUsers: users.size,
            timestamp: Date.now()
        };

        cache.questionStats.set(questionId, {
            data: stats,
            timestamp: Date.now()
        });

        res.json(stats);

    } catch (error) {
        next(error);
    }
});

// Legacy: Submit answer
app.post('/api/submit-answer', rateLimiter.writeHeavy, async (req, res, next) => {
    try {
        const { username, question_id, answer_value, timestamp } = req.body;

        const normalizedTimestamp = normalizeTimestamp(timestamp || Date.now());

        const { data, error } = await supabase
            .from('answers')
            .upsert([{
                username,
                question_id,
                answer_value,
                timestamp: normalizedTimestamp
            }], { onConflict: 'username,question_id' });

        if (error) throw error;

        cache.lastUpdate = 0;
        cache.questionStats.delete(question_id);

        res.json({
            success: true,
            timestamp: normalizedTimestamp,
            broadcast: 0 // Will be handled by WebSocket in server.js
        });

    } catch (error) {
        next(error);
    }
});

// Legacy: Batch submit
app.post('/api/batch-submit', rateLimiter.writeHeavy, async (req, res, next) => {
    try {
        const { answers } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ error: 'Invalid answers array' });
        }

        const normalizedAnswers = answers.map(answer => ({
            ...answer,
            timestamp: normalizeTimestamp(answer.timestamp || Date.now())
        }));

        const { data, error } = await supabase
            .from('answers')
            .upsert(normalizedAnswers, { onConflict: 'username,question_id' });

        if (error) throw error;

        cache.lastUpdate = 0;
        cache.questionStats.clear();

        res.json({
            success: true,
            count: normalizedAnswers.length,
            broadcast: 0
        });

    } catch (error) {
        next(error);
    }
});

// Legacy: Get server stats
app.get('/api/stats', rateLimiter.general, async (req, res, next) => {
    try {
        const { count: totalAnswers } = await supabase
            .from('answers')
            .select('*', { count: 'exact', head: true });

        const { data: users } = await supabase
            .from('answers')
            .select('username')
            .limit(1000);

        const uniqueUsers = new Set(users?.map(u => u.username) || []);

        res.json({
            totalAnswers,
            uniqueUsers: uniqueUsers.size,
            connectedClients: 0, // Will be populated by server.js
            cacheStatus: isCacheValid(cache.lastUpdate) ? 'warm' : 'cold',
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB'
        });

    } catch (error) {
        next(error);
    }
});

// ============================================
// Error Handling
// ============================================

// 404 handler for unknown routes
app.use(notFoundHandler);

// P11: Error logging middleware
app.use(errorLogging);

// Global error handler
app.use(errorHandler);

// Export cache for WebSocket integration
export { cache };

// Export app for testing
export default app;