import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateJWT, optionalJWT } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import * as profileController from '../controllers/profileController.js';
import * as progressController from '../controllers/progressController.js';
import * as answerController from '../controllers/answerController.js';
import * as voteController from '../controllers/voteController.js';
import * as badgeController from '../controllers/badgeController.js';
import * as activityController from '../controllers/activityController.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(e => ({
                field: e.path,
                message: e.msg,
                value: e.value
            }))
        });
    }
    next();
};

// ============================================
// Profile Endpoints
// ============================================

/**
 * POST /api/profiles
 * Create a new profile (anonymous auth)
 */
router.post('/profiles',
    rateLimiter.createProfile,
    [
        body('username')
            .isString()
            .matches(/^[A-Za-z0-9_]+$/)
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be 3-50 characters, alphanumeric and underscore only')
            .custom(value => {
                // Check for PII patterns
                const emailPattern = /\S+@\S+\.\S+/;
                const phonePattern = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/;
                if (emailPattern.test(value) || phonePattern.test(value)) {
                    throw new Error('Username cannot contain personal information');
                }
                return true;
            }),
        body('class_section_code')
            .optional()
            .isString()
            .isLength({ min: 4, max: 20 })
            .withMessage('Class code must be 4-20 characters')
    ],
    handleValidationErrors,
    profileController.createProfile
);

/**
 * GET /api/profiles/:username
 * Get profile by username
 */
router.get('/profiles/:username',
    rateLimiter.general,
    [
        param('username')
            .isString()
            .matches(/^[A-Za-z0-9_]+$/)
            .isLength({ min: 3, max: 50 })
    ],
    handleValidationErrors,
    optionalJWT,
    profileController.getProfile
);

/**
 * PATCH /api/profiles/:username
 * Update profile (own profile only)
 */
router.patch('/profiles/:username',
    rateLimiter.general,
    authenticateJWT,
    [
        param('username').isString(),
        body('current_unit').optional().isString().isLength({ max: 50 }),
        body('current_lesson').optional().isString().isLength({ max: 50 }),
        body('avatar_config').optional().isJSON()
    ],
    handleValidationErrors,
    profileController.updateProfile
);

// ============================================
// Progress Endpoints
// ============================================

/**
 * GET /api/progress/:username
 * Get all progress for a user
 */
router.get('/progress/:username',
    rateLimiter.general,
    [
        param('username').isString().matches(/^[A-Za-z0-9_]+$/)
    ],
    handleValidationErrors,
    optionalJWT,
    progressController.getUserProgress
);

/**
 * POST /api/progress
 * Create or update progress record
 */
router.post('/progress',
    rateLimiter.writeHeavy,
    authenticateJWT,
    [
        body('unit_id').isString().isLength({ max: 50 }),
        body('lesson_id').isString().isLength({ max: 50 }),
        body('questions_completed').isInt({ min: 0 }),
        body('questions_total').isInt({ min: 1 }),
        body('time_spent_seconds').optional().isInt({ min: 0 })
    ],
    handleValidationErrors,
    progressController.upsertProgress
);

/**
 * GET /api/progress/class/:section_code
 * Get class progress summary (teacher only)
 */
router.get('/progress/class/:section_code',
    rateLimiter.general,
    authenticateJWT,
    [
        param('section_code').isString().isLength({ min: 4, max: 20 })
    ],
    handleValidationErrors,
    progressController.getClassProgress
);

// ============================================
// Answer Endpoints
// ============================================

/**
 * GET /api/answers/:question_id
 * Get all answers for a question (peer learning)
 */
router.get('/answers/:question_id',
    rateLimiter.general,
    [
        param('question_id').isString().isLength({ max: 50 }),
        query('attempt').optional().isInt({ min: 1 })
    ],
    handleValidationErrors,
    optionalJWT,
    answerController.getQuestionAnswers
);

/**
 * POST /api/answers
 * Submit an answer
 */
router.post('/answers',
    rateLimiter.writeHeavy,
    authenticateJWT,
    [
        body('question_id').isString().isLength({ max: 50 }),
        body('answer_value').isString().isLength({ max: 2000 }),
        body('reasoning').optional().isString().isLength({ max: 2000 }),
        body('chart_data').optional().isJSON(),
        body('attempt_number').optional().isInt({ min: 1, max: 10 })
    ],
    handleValidationErrors,
    answerController.submitAnswer
);

/**
 * GET /api/answers/:question_id/stats
 * Get answer statistics for a question
 */
router.get('/answers/:question_id/stats',
    rateLimiter.general,
    [
        param('question_id').isString().isLength({ max: 50 })
    ],
    handleValidationErrors,
    answerController.getAnswerStats
);

// ============================================
// Vote Endpoints
// ============================================

/**
 * GET /api/votes/:question_id
 * Get votes for a question
 */
router.get('/votes/:question_id',
    rateLimiter.general,
    [
        param('question_id').isString().isLength({ max: 50 })
    ],
    handleValidationErrors,
    voteController.getQuestionVotes
);

/**
 * POST /api/votes
 * Cast a vote
 */
router.post('/votes',
    rateLimiter.writeModerate,
    authenticateJWT,
    [
        body('question_id').isString().isLength({ max: 50 }),
        body('target_username').isString().matches(/^[A-Za-z0-9_]+$/),
        body('vote_type').isIn(['helpful', 'correct', 'creative'])
    ],
    handleValidationErrors,
    voteController.castVote
);

/**
 * DELETE /api/votes/:vote_id
 * Remove a vote
 */
router.delete('/votes/:vote_id',
    rateLimiter.general,
    authenticateJWT,
    [
        param('vote_id').isUUID()
    ],
    handleValidationErrors,
    voteController.removeVote
);

// ============================================
// Badge Endpoints
// ============================================

/**
 * GET /api/badges/:username
 * Get badges for a user
 */
router.get('/badges/:username',
    rateLimiter.general,
    [
        param('username').isString().matches(/^[A-Za-z0-9_]+$/)
    ],
    handleValidationErrors,
    badgeController.getUserBadges
);

/**
 * POST /api/badges
 * Award a badge (teacher or system only)
 */
router.post('/badges',
    rateLimiter.general,
    authenticateJWT,
    [
        body('badge_type').isString().isLength({ max: 50 }),
        body('username').isString().matches(/^[A-Za-z0-9_]+$/),
        body('metadata').optional().isJSON()
    ],
    handleValidationErrors,
    badgeController.awardBadge
);

/**
 * GET /api/badges/leaderboard/:section_code
 * Get badge leaderboard for a class
 */
router.get('/badges/leaderboard/:section_code',
    rateLimiter.general,
    [
        param('section_code').isString().isLength({ min: 4, max: 20 }),
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    handleValidationErrors,
    badgeController.getLeaderboard
);

// ============================================
// Activity Endpoints
// ============================================

/**
 * GET /api/activity/online
 * Get currently online users
 */
router.get('/activity/online',
    rateLimiter.general,
    [
        query('class_section_code').optional().isString()
    ],
    handleValidationErrors,
    activityController.getOnlineUsers
);

/**
 * POST /api/activity
 * Update user activity (heartbeat)
 */
router.post('/activity',
    rateLimiter.heartbeat,
    authenticateJWT,
    [
        body('activity_state').isIn(['online', 'idle', 'answering', 'viewing']),
        body('current_question').optional().isString().isLength({ max: 50 }),
        body('current_page').optional().isString().isLength({ max: 100 })
    ],
    handleValidationErrors,
    activityController.updateActivity
);

/**
 * GET /api/activity/question/:question_id
 * Get users currently on a question
 */
router.get('/activity/question/:question_id',
    rateLimiter.general,
    [
        param('question_id').isString().isLength({ max: 50 })
    ],
    handleValidationErrors,
    activityController.getQuestionActivity
);

// ============================================
// Class Section Endpoints
// ============================================

/**
 * POST /api/classes
 * Create a new class section (teacher only)
 */
router.post('/classes',
    rateLimiter.general,
    authenticateJWT,
    [
        body('section_name').isString().isLength({ min: 1, max: 100 }),
        body('section_code').isString().matches(/^[A-Z0-9]{4,20}$/),
        body('settings').optional().isJSON()
    ],
    handleValidationErrors,
    profileController.createClassSection
);

/**
 * GET /api/classes/:section_code
 * Get class section details
 */
router.get('/classes/:section_code',
    rateLimiter.general,
    [
        param('section_code').isString().matches(/^[A-Z0-9]{4,20}$/)
    ],
    handleValidationErrors,
    optionalJWT,
    profileController.getClassSection
);

// ============================================
// Aggregate Endpoints (Cached)
// ============================================

/**
 * GET /api/consensus/:question_id
 * Get consensus data for a question (cached 30s)
 */
router.get('/consensus/:question_id',
    rateLimiter.general,
    [
        param('question_id').isString().isLength({ max: 50 })
    ],
    handleValidationErrors,
    answerController.getConsensusData
);

/**
 * GET /api/peer-data
 * Get all peer data (cached 30s)
 */
router.get('/peer-data',
    rateLimiter.general,
    [
        query('class_section_code').optional().isString()
    ],
    handleValidationErrors,
    answerController.getAllPeerData
);

// ============================================
// Health Check
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

export default router;