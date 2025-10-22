-- ============================================
-- Migration 002: Row Level Security Policies
-- Created: 2025-10-22
-- Description: Implement RLS for all tables with anonymous auth model
-- ============================================

BEGIN;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE class_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get current username
-- ============================================
-- In anonymous auth model, username is passed via custom JWT claim
-- or can be set via session variable for testing

CREATE OR REPLACE FUNCTION current_username()
RETURNS VARCHAR(50) AS $$
BEGIN
    -- Try to get from JWT claims first
    RETURN current_setting('request.jwt.claims.username', true);
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback to session variable (for testing)
        RETURN current_setting('app.current_username', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- HELPER FUNCTION: Check if current user is teacher
-- ============================================

CREATE OR REPLACE FUNCTION is_current_user_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM profiles
        WHERE username = current_username()
        AND is_teacher = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TABLE: class_sections
-- ============================================

-- Anyone can view their own class section
CREATE POLICY "View own class section"
    ON class_sections FOR SELECT
    USING (
        -- Teacher can see classes they teach
        teacher_username = current_username()
        OR
        -- Students can see class they're in
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE username = current_username()
            AND class_section_id = class_sections.id
        )
    );

-- Only teachers can create/update classes
CREATE POLICY "Teachers manage classes"
    ON class_sections FOR INSERT
    WITH CHECK (
        teacher_username = current_username()
        AND is_current_user_teacher()
    );

CREATE POLICY "Teachers update own classes"
    ON class_sections FOR UPDATE
    USING (teacher_username = current_username() AND is_current_user_teacher())
    WITH CHECK (teacher_username = current_username() AND is_current_user_teacher());

-- Teachers can delete own classes
CREATE POLICY "Teachers delete own classes"
    ON class_sections FOR DELETE
    USING (teacher_username = current_username() AND is_current_user_teacher());

-- ============================================
-- TABLE: profiles
-- ============================================

-- Anyone can read all profiles (peer learning, anonymous usernames)
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can create own profile"
    ON profiles FOR INSERT
    WITH CHECK (username = current_username());

-- Users can only update their own profile
CREATE POLICY "Users update own profile"
    ON profiles FOR UPDATE
    USING (username = current_username())
    WITH CHECK (username = current_username());

-- Users cannot delete profiles (system-only operation)
-- No DELETE policy = no user can delete

-- ============================================
-- TABLE: progress
-- ============================================

-- Users see own progress; teachers see class progress
CREATE POLICY "View own or class progress"
    ON progress FOR SELECT
    USING (
        username = current_username()
        OR
        (
            is_current_user_teacher()
            AND EXISTS (
                SELECT 1
                FROM profiles p
                JOIN class_sections cs ON p.class_section_id = cs.id
                WHERE p.username = progress.username
                AND cs.teacher_username = current_username()
            )
        )
    );

-- Users manage only their own progress
CREATE POLICY "Users manage own progress"
    ON progress FOR INSERT
    WITH CHECK (username = current_username());

CREATE POLICY "Users update own progress"
    ON progress FOR UPDATE
    USING (username = current_username())
    WITH CHECK (username = current_username());

CREATE POLICY "Users delete own progress"
    ON progress FOR DELETE
    USING (username = current_username());

-- ============================================
-- TABLE: answers
-- ============================================

-- Everyone can read all answers (peer learning, consensus building)
CREATE POLICY "Answers are viewable for peer learning"
    ON answers FOR SELECT
    USING (true);

-- Users can only insert their own answers
CREATE POLICY "Users insert own answers"
    ON answers FOR INSERT
    WITH CHECK (username = current_username());

-- Users can only update their own answers
CREATE POLICY "Users update own answers"
    ON answers FOR UPDATE
    USING (username = current_username())
    WITH CHECK (username = current_username());

-- Users can delete own answers (for retakes)
CREATE POLICY "Users delete own answers"
    ON answers FOR DELETE
    USING (username = current_username());

-- ============================================
-- TABLE: votes
-- ============================================

-- Everyone can view votes (see consensus, vote counts)
CREATE POLICY "Votes are publicly viewable"
    ON votes FOR SELECT
    USING (true);

-- Users can vote, but only for others (not self)
CREATE POLICY "Users vote for others only"
    ON votes FOR INSERT
    WITH CHECK (
        voter_username = current_username()
        AND voter_username != target_username
    );

-- Users can remove their own votes
CREATE POLICY "Users remove own votes"
    ON votes FOR DELETE
    USING (voter_username = current_username());

-- Users cannot update votes (delete and re-insert instead)
-- No UPDATE policy

-- ============================================
-- TABLE: badges
-- ============================================

-- Everyone can view badges (public achievements)
CREATE POLICY "Badges are public achievements"
    ON badges FOR SELECT
    USING (true);

-- Only system (service role) can grant badges
-- No INSERT/UPDATE/DELETE policies for anon/authenticated users

-- Optional: Teachers can grant badges to their students
CREATE POLICY "Teachers grant badges to students"
    ON badges FOR INSERT
    WITH CHECK (
        is_current_user_teacher()
        AND EXISTS (
            SELECT 1
            FROM profiles p
            JOIN class_sections cs ON p.class_section_id = cs.id
            WHERE p.username = badges.username
            AND cs.teacher_username = current_username()
        )
    );

-- ============================================
-- TABLE: user_activity
-- ============================================

-- Everyone can view activity (presence feature)
CREATE POLICY "Activity is publicly viewable"
    ON user_activity FOR SELECT
    USING (true);

-- Users manage only their own activity
CREATE POLICY "Users manage own activity"
    ON user_activity FOR INSERT
    WITH CHECK (username = current_username());

CREATE POLICY "Users update own activity"
    ON user_activity FOR UPDATE
    USING (username = current_username())
    WITH CHECK (username = current_username());

CREATE POLICY "Users delete own activity"
    ON user_activity FOR DELETE
    USING (username = current_username());

-- ============================================
-- ADDITIONAL SECURITY CONSTRAINTS
-- ============================================

-- Prevent privilege escalation: users can't make themselves teachers
CREATE OR REPLACE FUNCTION prevent_teacher_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- If updating is_teacher flag
    IF TG_OP = 'UPDATE' AND NEW.is_teacher != OLD.is_teacher THEN
        -- Only service role or existing teachers can modify is_teacher
        IF NOT is_current_user_teacher() THEN
            RAISE EXCEPTION 'Only system administrators can grant teacher privileges';
        END IF;
    END IF;

    -- If inserting, ensure is_teacher defaults to false for non-teachers
    IF TG_OP = 'INSERT' AND NEW.is_teacher = TRUE THEN
        IF NOT is_current_user_teacher() THEN
            RAISE EXCEPTION 'Cannot create teacher account through normal registration';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_teacher_privileges
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_teacher_escalation();

COMMIT;

-- Validate RLS is enabled
DO $$
DECLARE
    rls_count INT;
BEGIN
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('class_sections', 'profiles', 'progress', 'answers', 'votes', 'badges', 'user_activity')
    AND rowsecurity = TRUE;

    IF rls_count < 7 THEN
        RAISE EXCEPTION 'RLS not enabled on all tables. Expected 7, got %', rls_count;
    END IF;

    RAISE NOTICE 'Migration 002 completed successfully: RLS enabled on % tables', rls_count;
END $$;
