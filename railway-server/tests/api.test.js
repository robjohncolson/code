import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import app from '../app.js';

// Test configuration
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;
let testToken;
let testUsername;
let teacherToken;

// ============================================
// Test Setup
// ============================================

beforeAll(async () => {
    // Initialize test Supabase client
    supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);

    console.log('🧪 Starting API integration tests...');
});

afterAll(async () => {
    // Cleanup test data
    if (testUsername) {
        await supabase.from('profiles').delete().eq('username', testUsername);
    }

    console.log('✅ API integration tests complete');
});

beforeEach(async () => {
    // Generate unique test username for each test
    testUsername = `Test_User_${Date.now()}`;
});

// ============================================
// Authentication Tests
// ============================================

describe('POST /api/profiles - Create Profile', () => {
    it('should create a profile with valid username', async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername })
            .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.profile).toBeDefined();
        expect(response.body.profile.username).toBe(testUsername);
        expect(response.body.profile.is_teacher).toBe(false);

        // Save token for subsequent tests
        testToken = response.body.token;
    });

    it('should reject username with PII (email)', async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: 'john@email.com' })
            .expect(400);

        expect(response.body.error).toBeDefined();
        expect(response.body.details).toBeDefined();
        expect(response.body.details[0].field).toBe('username');
    });

    it('should reject username with PII (phone)', async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: '555-123-4567' })
            .expect(400);

        expect(response.body.error).toBeDefined();
    });

    it('should reject too short username', async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: 'ab' })
            .expect(400);

        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details[0].field).toBe('username');
    });

    it('should reject duplicate username', async () => {
        // Create first profile
        await request(app)
            .post('/api/profiles')
            .send({ username: testUsername })
            .expect(201);

        // Try to create duplicate
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername })
            .expect(409);

        expect(response.body.error).toBe('Conflict');
    });
});

// ============================================
// Profile Tests
// ============================================

describe('GET /api/profiles/:username - Get Profile', () => {
    beforeEach(async () => {
        // Create test profile
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername });
        testToken = response.body.token;
    });

    it('should get profile by username', async () => {
        const response = await request(app)
            .get(`/api/profiles/${testUsername}`)
            .expect(200);

        expect(response.body.username).toBe(testUsername);
        expect(response.body.total_questions_answered).toBeDefined();
        expect(response.body.badges_earned).toBeDefined();
    });

    it('should return 404 for non-existent profile', async () => {
        const response = await request(app)
            .get('/api/profiles/NonExistentUser_12345')
            .expect(404);

        expect(response.body.error).toBe('Not Found');
    });
});

describe('PATCH /api/profiles/:username - Update Profile', () => {
    beforeEach(async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername });
        testToken = response.body.token;
    });

    it('should update own profile', async () => {
        const response = await request(app)
            .patch(`/api/profiles/${testUsername}`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                current_unit: 'unit1',
                current_lesson: 'lesson2'
            })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.profile.current_unit).toBe('unit1');
        expect(response.body.profile.current_lesson).toBe('lesson2');
    });

    it('should reject update without authentication', async () => {
        const response = await request(app)
            .patch(`/api/profiles/${testUsername}`)
            .send({ current_unit: 'unit1' })
            .expect(401);

        expect(response.body.error).toBe('Authentication required');
    });

    it('should reject updating another user profile', async () => {
        // Create second user
        const secondUser = `Test_User_${Date.now() + 1000}`;
        await request(app)
            .post('/api/profiles')
            .send({ username: secondUser });

        // Try to update with first user's token
        const response = await request(app)
            .patch(`/api/profiles/${secondUser}`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ current_unit: 'hacked' })
            .expect(403);

        expect(response.body.error).toBe('Forbidden');
    });

    it('should prevent teacher privilege escalation', async () => {
        const response = await request(app)
            .patch(`/api/profiles/${testUsername}`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ is_teacher: true })
            .expect(200);

        // is_teacher should be ignored
        expect(response.body.profile.is_teacher).toBe(false);
    });
});

// ============================================
// Answer Tests
// ============================================

describe('POST /api/answers - Submit Answer', () => {
    beforeEach(async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername });
        testToken = response.body.token;
    });

    it('should submit an answer with authentication', async () => {
        const response = await request(app)
            .post('/api/answers')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                question_id: 'U1-L1-Q01',
                answer_value: 'B',
                reasoning: 'Test reasoning'
            })
            .expect(201);

        expect(response.body.username).toBe(testUsername);
        expect(response.body.question_id).toBe('U1-L1-Q01');
        expect(response.body.answer_value).toBe('B');
    });

    it('should reject answer without authentication', async () => {
        const response = await request(app)
            .post('/api/answers')
            .send({
                question_id: 'U1-L1-Q01',
                answer_value: 'B'
            })
            .expect(401);

        expect(response.body.error).toBe('Authentication required');
    });

    it('should handle multiple attempts', async () => {
        // First attempt
        await request(app)
            .post('/api/answers')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                question_id: 'U1-L1-Q02',
                answer_value: 'A',
                attempt_number: 1
            })
            .expect(201);

        // Second attempt
        const response = await request(app)
            .post('/api/answers')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                question_id: 'U1-L1-Q02',
                answer_value: 'B',
                attempt_number: 2
            })
            .expect(201);

        expect(response.body.attempt_number).toBe(2);
    });
});

describe('GET /api/answers/:question_id - Get Peer Answers', () => {
    beforeEach(async () => {
        // Create multiple test users with answers
        const users = ['Apple_Test', 'Banana_Test', 'Cherry_Test'];

        for (const username of users) {
            const profileResponse = await request(app)
                .post('/api/profiles')
                .send({ username: `${username}_${Date.now()}` });

            const token = profileResponse.body.token;

            await request(app)
                .post('/api/answers')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    question_id: 'U1-L1-Q03',
                    answer_value: ['A', 'B', 'A'][users.indexOf(username)]
                });
        }
    });

    it('should get all answers for a question', async () => {
        const response = await request(app)
            .get('/api/answers/U1-L1-Q03')
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(3);
        expect(response.body[0]).toHaveProperty('username');
        expect(response.body[0]).toHaveProperty('answer_value');
    });
});

describe('GET /api/answers/:question_id/stats - Answer Statistics', () => {
    it('should get answer statistics', async () => {
        const response = await request(app)
            .get('/api/answers/U1-L1-Q03/stats')
            .expect(200);

        expect(response.body).toHaveProperty('question_id');
        expect(response.body).toHaveProperty('total_answers');
        expect(response.body).toHaveProperty('unique_students');
        expect(response.body).toHaveProperty('answer_distribution');
    });
});

// ============================================
// Vote Tests
// ============================================

describe('POST /api/votes - Cast Vote', () => {
    let voterToken;
    let targetUsername;

    beforeEach(async () => {
        // Create voter
        const voterResponse = await request(app)
            .post('/api/profiles')
            .send({ username: `Voter_${Date.now()}` });
        voterToken = voterResponse.body.token;

        // Create target user with answer
        const targetResponse = await request(app)
            .post('/api/profiles')
            .send({ username: `Target_${Date.now()}` });
        targetUsername = targetResponse.body.profile.username;
        const targetToken = targetResponse.body.token;

        await request(app)
            .post('/api/answers')
            .set('Authorization', `Bearer ${targetToken}`)
            .send({
                question_id: 'U1-L1-Q04',
                answer_value: 'A'
            });
    });

    it('should cast a vote for peer answer', async () => {
        const response = await request(app)
            .post('/api/votes')
            .set('Authorization', `Bearer ${voterToken}`)
            .send({
                question_id: 'U1-L1-Q04',
                target_username: targetUsername,
                vote_type: 'helpful'
            })
            .expect(201);

        expect(response.body.vote_type).toBe('helpful');
        expect(response.body.target_username).toBe(targetUsername);
    });

    it('should reject voting without authentication', async () => {
        const response = await request(app)
            .post('/api/votes')
            .send({
                question_id: 'U1-L1-Q04',
                target_username: targetUsername,
                vote_type: 'helpful'
            })
            .expect(401);

        expect(response.body.error).toBe('Authentication required');
    });

    it('should reject invalid vote type', async () => {
        const response = await request(app)
            .post('/api/votes')
            .set('Authorization', `Bearer ${voterToken}`)
            .send({
                question_id: 'U1-L1-Q04',
                target_username: targetUsername,
                vote_type: 'invalid_type'
            })
            .expect(400);

        expect(response.body.error).toBe('Validation failed');
    });
});

// ============================================
// Progress Tests
// ============================================

describe('POST /api/progress - Update Progress', () => {
    beforeEach(async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername });
        testToken = response.body.token;
    });

    it('should update progress', async () => {
        const response = await request(app)
            .post('/api/progress')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                unit_id: 'unit1',
                lesson_id: 'lesson1',
                questions_completed: 5,
                questions_total: 10
            })
            .expect(200);

        expect(response.body.unit_id).toBe('unit1');
        expect(response.body.questions_completed).toBe(5);
        expect(response.body.completion_percentage).toBe(50);
    });

    it('should reject progress without authentication', async () => {
        const response = await request(app)
            .post('/api/progress')
            .send({
                unit_id: 'unit1',
                lesson_id: 'lesson1',
                questions_completed: 5,
                questions_total: 10
            })
            .expect(401);

        expect(response.body.error).toBe('Authentication required');
    });
});

describe('GET /api/progress/:username - Get User Progress', () => {
    beforeEach(async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername });
        testToken = response.body.token;

        // Create some progress
        await request(app)
            .post('/api/progress')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                unit_id: 'unit1',
                lesson_id: 'lesson1',
                questions_completed: 10,
                questions_total: 10
            });
    });

    it('should get user progress', async () => {
        const response = await request(app)
            .get(`/api/progress/${testUsername}`)
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('unit_id');
        expect(response.body[0]).toHaveProperty('completion_percentage');
    });
});

// ============================================
// Rate Limiting Tests
// ============================================

describe('Rate Limiting', () => {
    it('should enforce rate limits on profile creation', async () => {
        const requests = [];

        // Make 6 requests (limit is 5 per hour)
        for (let i = 0; i < 6; i++) {
            requests.push(
                request(app)
                    .post('/api/profiles')
                    .send({ username: `RateTest_${Date.now()}_${i}` })
            );
        }

        const responses = await Promise.all(requests);

        // At least one should be rate limited
        const rateLimited = responses.some(r => r.status === 429);
        expect(rateLimited).toBe(true);
    });
});

// ============================================
// Error Handling Tests
// ============================================

describe('Error Handling', () => {
    it('should return standardized 404 error', async () => {
        const response = await request(app)
            .get('/api/profiles/NonExistentUser_999999')
            .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.error).toBe('Not Found');
    });

    it('should return standardized validation error', async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: '' })
            .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('details');
        expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should handle malformed JSON', async () => {
        const response = await request(app)
            .post('/api/profiles')
            .set('Content-Type', 'application/json')
            .send('{"invalid json')
            .expect(400);

        expect(response.body).toHaveProperty('error');
    });
});

// ============================================
// Health Check Tests
// ============================================

describe('GET /api/health - Health Check', () => {
    it('should return healthy status', async () => {
        const response = await request(app)
            .get('/api/health')
            .expect(200);

        expect(response.body.status).toBe('healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('memory');
    });
});

// ============================================
// JWT Token Tests
// ============================================

describe('JWT Token Handling', () => {
    beforeEach(async () => {
        const response = await request(app)
            .post('/api/profiles')
            .send({ username: testUsername });
        testToken = response.body.token;
    });

    it('should accept valid Bearer token', async () => {
        const response = await request(app)
            .get(`/api/progress/${testUsername}`)
            .set('Authorization', `Bearer ${testToken}`)
            .expect(200);

        expect(response.body).toBeDefined();
    });

    it('should reject invalid token', async () => {
        const response = await request(app)
            .post('/api/answers')
            .set('Authorization', 'Bearer invalid_token_12345')
            .send({
                question_id: 'U1-L1-Q01',
                answer_value: 'A'
            })
            .expect(401);

        expect(response.body.error).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
        // This would require creating a token with past expiration
        // For now, we test the error format
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjB9.invalid';

        const response = await request(app)
            .post('/api/answers')
            .set('Authorization', `Bearer ${expiredToken}`)
            .send({
                question_id: 'U1-L1-Q01',
                answer_value: 'A'
            })
            .expect(401);

        expect(response.body.error).toBeDefined();
    });

    it('should reject request with no auth header', async () => {
        const response = await request(app)
            .post('/api/answers')
            .send({
                question_id: 'U1-L1-Q01',
                answer_value: 'A'
            })
            .expect(401);

        expect(response.body.error).toBe('Authentication required');
    });
});

export default {
    app,
    supabase,
    testUsername,
    testToken
};