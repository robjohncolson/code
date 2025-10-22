-- ============================================
-- AP Statistics Consensus Quiz - Database Schema v2
-- ============================================
-- This schema supports anonymous student profiles, progress tracking,
-- peer collaboration, and teacher oversight.
--
-- Key Design Principles:
-- 1. No PII stored (usernames are Fruit_Animal format)
-- 2. Anonymous authentication (no auth.users table)
-- 3. Username is primary identifier
-- 4. RLS policies enforce data access rules
-- 5. Optimized for peer learning and consensus features
-- ============================================

-- ============================================
-- TABLE: class_sections
-- Group students into classes for teacher management
-- ============================================
CREATE TABLE IF NOT EXISTS class_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section_code VARCHAR(20) UNIQUE NOT NULL,
    teacher_username VARCHAR(50) NOT NULL,
    section_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{"peer_visibility": true, "voting_enabled": true, "chart_wizard_enabled": true}'::jsonb,

    CONSTRAINT section_code_format CHECK (section_code ~ '^[A-Z0-9_-]+$')
);

COMMENT ON TABLE class_sections IS 'Class sections for grouping students and teacher management';
COMMENT ON COLUMN class_sections.settings IS 'Class-level feature flags and configuration';

-- ============================================
-- TABLE: profiles
-- Anonymous user profiles (students and teachers)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    username VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    total_questions_answered INT DEFAULT 0 CHECK (total_questions_answered >= 0),
    total_votes_received INT DEFAULT 0 CHECK (total_votes_received >= 0),
    current_unit VARCHAR(20),
    current_question VARCHAR(20),
    is_teacher BOOLEAN DEFAULT FALSE,
    class_section_id UUID REFERENCES class_sections(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT username_format CHECK (username ~ '^[A-Za-z0-9_]+$'),
    CONSTRAINT username_length CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 50)
);

COMMENT ON TABLE profiles IS 'Anonymous user profiles with Fruit_Animal username format';
COMMENT ON COLUMN profiles.username IS 'Anonymous username in Fruit_Animal format (e.g., Apple_Penguin)';
COMMENT ON COLUMN profiles.metadata IS 'Flexible JSON field for future extensions (preferences, settings, etc.)';

-- ============================================
-- TABLE: progress
-- Track student progress through curriculum units/lessons
-- ============================================
CREATE TABLE IF NOT EXISTS progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    unit_id VARCHAR(20) NOT NULL,
    lesson_id VARCHAR(20),
    questions_completed INT DEFAULT 0 CHECK (questions_completed >= 0),
    questions_total INT DEFAULT 0 CHECK (questions_total >= 0),
    completion_percentage DECIMAL(5,2) DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    time_spent_seconds INT DEFAULT 0 CHECK (time_spent_seconds >= 0),
    last_activity TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_unit_lesson UNIQUE(username, unit_id, lesson_id),
    CONSTRAINT completion_logic CHECK (
        (completed_at IS NULL) OR
        (completed_at >= started_at AND completion_percentage = 100)
    ),
    CONSTRAINT questions_logic CHECK (questions_completed <= questions_total)
);

COMMENT ON TABLE progress IS 'Tracks student progress through curriculum units and lessons';
COMMENT ON COLUMN progress.completion_percentage IS 'Calculated as (questions_completed / questions_total) * 100';

-- ============================================
-- TABLE: answers
-- Student answers to quiz questions
-- ============================================
CREATE TABLE IF NOT EXISTS answers (
    username VARCHAR(50) NOT NULL,
    question_id VARCHAR(50) NOT NULL,
    attempt_number INT DEFAULT 1 CHECK (attempt_number > 0),
    answer_value TEXT NOT NULL,
    answer_type VARCHAR(20) DEFAULT 'multiple-choice',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    time_spent_seconds INT CHECK (time_spent_seconds >= 0),
    confidence_level INT CHECK (confidence_level BETWEEN 1 AND 5),
    reasoning TEXT,
    is_correct BOOLEAN,
    chart_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (username, question_id, attempt_number),
    FOREIGN KEY (username) REFERENCES profiles(username) ON DELETE CASCADE,

    CONSTRAINT answer_type_valid CHECK (answer_type IN (
        'multiple-choice',
        'free-response',
        'chart-response',
        'numerical'
    ))
);

COMMENT ON TABLE answers IS 'Student answers with support for multiple attempts and various question types';
COMMENT ON COLUMN answers.chart_data IS 'For graph questions, stores chart configuration in SIF (Standard Internal Format)';
COMMENT ON COLUMN answers.reasoning IS 'Student explanation or reasoning for their answer';

-- ============================================
-- TABLE: votes
-- Peer voting system for collaborative learning
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id VARCHAR(50) NOT NULL,
    voter_username VARCHAR(50) NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    target_username VARCHAR(50) NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    vote_type VARCHAR(20) DEFAULT 'helpful',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_vote UNIQUE(question_id, voter_username, target_username, vote_type),
    CONSTRAINT no_self_vote CHECK (voter_username != target_username),
    CONSTRAINT vote_type_valid CHECK (vote_type IN ('helpful', 'clear', 'creative', 'insightful'))
);

COMMENT ON TABLE votes IS 'Peer voting for answer quality (consensus building)';
COMMENT ON COLUMN votes.vote_type IS 'Type of vote: helpful, clear, creative, insightful';

-- ============================================
-- TABLE: badges
-- Achievement system for student engagement
-- ============================================
CREATE TABLE IF NOT EXISTS badges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    badge_type VARCHAR(50) NOT NULL,
    badge_name VARCHAR(100),
    badge_description TEXT,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT unique_user_badge UNIQUE(username, badge_type),
    CONSTRAINT badge_type_valid CHECK (badge_type ~ '^[a-z_]+$')
);

COMMENT ON TABLE badges IS 'Student achievement badges for engagement and milestones';
COMMENT ON COLUMN badges.metadata IS 'Context about badge earning (e.g., which unit, score, etc.)';

-- ============================================
-- TABLE: user_activity
-- Real-time presence tracking
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity (
    username VARCHAR(50) PRIMARY KEY REFERENCES profiles(username) ON DELETE CASCADE,
    activity_state VARCHAR(20) DEFAULT 'idle',
    current_question_id VARCHAR(50),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    session_id UUID,
    ip_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),

    CONSTRAINT activity_state_valid CHECK (activity_state IN (
        'idle',
        'viewing',
        'answering',
        'submitted',
        'reviewing_peers'
    ))
);

COMMENT ON TABLE user_activity IS 'Real-time user presence and activity state';
COMMENT ON COLUMN user_activity.ip_hash IS 'SHA256 hash of IP for rate limiting (privacy-safe)';
COMMENT ON COLUMN user_activity.user_agent_hash IS 'SHA256 hash of user agent for device tracking';

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_class_section ON profiles(class_section_id)
    WHERE class_section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_teacher ON profiles(is_teacher)
    WHERE is_teacher = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen DESC);

-- Progress indexes
CREATE INDEX IF NOT EXISTS idx_progress_username ON progress(username);
CREATE INDEX IF NOT EXISTS idx_progress_unit ON progress(unit_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_unit ON progress(username, unit_id);
CREATE INDEX IF NOT EXISTS idx_progress_completion ON progress(completion_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_progress_last_activity ON progress(last_activity DESC);

-- Answers indexes
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_username ON answers(username);
CREATE INDEX IF NOT EXISTS idx_answers_timestamp ON answers(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_answers_type ON answers(answer_type);

-- Votes indexes
CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_username);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_username);
CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at DESC);

-- Badges indexes
CREATE INDEX IF NOT EXISTS idx_badges_username ON badges(username);
CREATE INDEX IF NOT EXISTS idx_badges_type ON badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_badges_earned ON badges(earned_at DESC);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_activity_last ON user_activity(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_activity_state ON user_activity(activity_state);
CREATE INDEX IF NOT EXISTS idx_activity_question ON user_activity(current_question_id)
    WHERE current_question_id IS NOT NULL;

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for class_sections
CREATE TRIGGER update_class_sections_updated_at
    BEFORE UPDATE ON class_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for answers
CREATE TRIGGER update_answers_updated_at
    BEFORE UPDATE ON answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update profile stats on answer insert
CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET
        total_questions_answered = (
            SELECT COUNT(DISTINCT question_id)
            FROM answers
            WHERE username = NEW.username
        ),
        last_seen = NOW()
    WHERE username = NEW.username;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_profile_stats
    AFTER INSERT ON answers
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_stats();

-- Auto-update vote count on profile
CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles
        SET total_votes_received = total_votes_received + 1
        WHERE username = NEW.target_username;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles
        SET total_votes_received = GREATEST(0, total_votes_received - 1)
        WHERE username = OLD.target_username;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_vote_count
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_count();

-- ============================================
-- VIEWS for Common Queries
-- ============================================

-- Class summary view for teachers
CREATE OR REPLACE VIEW class_summary AS
SELECT
    cs.id as class_section_id,
    cs.section_code,
    cs.section_name,
    cs.teacher_username,
    COUNT(DISTINCT p.username) as total_students,
    AVG(p.total_questions_answered) as avg_questions_answered,
    COUNT(DISTINCT CASE WHEN p.last_seen > NOW() - INTERVAL '1 day' THEN p.username END) as active_today,
    COUNT(DISTINCT CASE WHEN p.last_seen > NOW() - INTERVAL '7 days' THEN p.username END) as active_week
FROM class_sections cs
LEFT JOIN profiles p ON p.class_section_id = cs.id AND p.is_teacher = FALSE
GROUP BY cs.id, cs.section_code, cs.section_name, cs.teacher_username;

COMMENT ON VIEW class_summary IS 'Teacher dashboard summary statistics per class';

-- Student progress summary view
CREATE OR REPLACE VIEW student_progress_summary AS
SELECT
    p.username,
    p.class_section_id,
    COUNT(DISTINCT pr.unit_id) as units_started,
    SUM(pr.questions_completed) as total_completed,
    AVG(pr.completion_percentage) as avg_completion,
    MAX(pr.last_activity) as last_activity
FROM profiles p
LEFT JOIN progress pr ON p.username = pr.username
GROUP BY p.username, p.class_section_id;

COMMENT ON VIEW student_progress_summary IS 'Per-student progress across all units';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage to anon role (public access with RLS)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO anon;

-- Grant usage to authenticated role (if needed later)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO authenticated;

-- ============================================
-- SCHEMA VALIDATION
-- ============================================

-- Verify all tables created
DO $$
DECLARE
    table_count INT;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'progress', 'answers', 'votes', 'badges', 'class_sections', 'user_activity');

    IF table_count < 7 THEN
        RAISE EXCEPTION 'Not all tables created. Expected 7, got %', table_count;
    END IF;

    RAISE NOTICE 'Schema validation passed: All % tables created successfully', table_count;
END $$;
