-- ============================================
-- Sample Queries for AP Statistics Quiz
-- Common query patterns for the application
-- ============================================

-- ============================================
-- TEACHER DASHBOARD QUERIES
-- ============================================

-- Get class summary for teacher
SELECT
    p.username,
    p.total_questions_answered,
    p.last_seen,
    COUNT(DISTINCT pr.unit_id) as units_started,
    AVG(pr.completion_percentage) as avg_completion,
    COUNT(DISTINCT b.badge_type) as badges_earned
FROM profiles p
LEFT JOIN progress pr ON p.username = pr.username
LEFT JOIN badges b ON p.username = b.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
AND p.is_teacher = FALSE
GROUP BY p.username, p.total_questions_answered, p.last_seen
ORDER BY avg_completion DESC, p.total_questions_answered DESC;

-- Get class activity today
SELECT
    p.username,
    ua.activity_state,
    ua.current_question_id,
    ua.last_activity,
    EXTRACT(EPOCH FROM (NOW() - ua.last_activity)) / 60 as minutes_since_activity
FROM profiles p
JOIN user_activity ua ON p.username = ua.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
AND ua.last_activity > NOW() - INTERVAL '1 day'
ORDER BY ua.last_activity DESC;

-- Get lesson completion stats for class
SELECT
    pr.unit_id,
    pr.lesson_id,
    COUNT(DISTINCT pr.username) as students_started,
    COUNT(DISTINCT CASE WHEN pr.completion_percentage = 100 THEN pr.username END) as students_completed,
    AVG(pr.completion_percentage) as avg_completion,
    AVG(pr.time_spent_seconds) / 60 as avg_time_minutes
FROM progress pr
JOIN profiles p ON pr.username = p.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY pr.unit_id, pr.lesson_id
ORDER BY pr.unit_id, pr.lesson_id;

-- Get most challenging questions (low correct rate)
SELECT
    a.question_id,
    COUNT(*) as total_attempts,
    COUNT(CASE WHEN a.is_correct THEN 1 END) as correct_count,
    ROUND(100.0 * COUNT(CASE WHEN a.is_correct THEN 1 END) / COUNT(*), 1) as correct_percentage,
    AVG(a.time_spent_seconds) as avg_time_seconds
FROM answers a
JOIN profiles p ON a.username = p.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
AND a.is_correct IS NOT NULL
GROUP BY a.question_id
HAVING COUNT(*) >= 5
ORDER BY correct_percentage ASC, avg_time_seconds DESC
LIMIT 10;

-- ============================================
-- STUDENT DASHBOARD QUERIES
-- ============================================

-- Get student's overall progress
SELECT
    pr.unit_id,
    COUNT(DISTINCT pr.lesson_id) as lessons_started,
    SUM(pr.questions_completed) as total_questions_completed,
    AVG(pr.completion_percentage) as avg_completion,
    SUM(pr.time_spent_seconds) / 3600.0 as total_hours_spent
FROM progress pr
WHERE pr.username = 'Apple_Penguin'
GROUP BY pr.unit_id
ORDER BY pr.unit_id;

-- Get student's recent activity
SELECT
    a.question_id,
    a.answer_value,
    a.is_correct,
    a.timestamp,
    a.time_spent_seconds
FROM answers a
WHERE a.username = 'Apple_Penguin'
ORDER BY a.timestamp DESC
LIMIT 20;

-- Get student's badges
SELECT
    badge_type,
    badge_name,
    badge_description,
    earned_at,
    metadata
FROM badges
WHERE username = 'Apple_Penguin'
ORDER BY earned_at DESC;

-- Get student's vote statistics
SELECT
    COUNT(*) as votes_received,
    vote_type,
    COUNT(DISTINCT voter_username) as unique_voters
FROM votes
WHERE target_username = 'Apple_Penguin'
GROUP BY vote_type
ORDER BY votes_received DESC;

-- ============================================
-- CONSENSUS / PEER LEARNING QUERIES
-- ============================================

-- Get peer answers for a question with vote counts
SELECT
    a.username,
    a.answer_value,
    a.reasoning,
    a.timestamp,
    COUNT(v.id) as votes_received,
    STRING_AGG(DISTINCT v.vote_type, ', ') as vote_types
FROM answers a
LEFT JOIN votes v ON v.target_username = a.username
    AND v.question_id = a.question_id
WHERE a.question_id = 'U1-L2-Q01'
GROUP BY a.username, a.answer_value, a.reasoning, a.timestamp
ORDER BY votes_received DESC, a.timestamp ASC;

-- Get answer distribution for a question
SELECT
    answer_value,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM answers
WHERE question_id = 'U1-L2-Q01'
AND attempt_number = 1
GROUP BY answer_value
ORDER BY count DESC;

-- Get most helpful students (by votes received)
SELECT
    p.username,
    COUNT(v.id) as total_votes,
    COUNT(DISTINCT v.vote_type) as vote_types_received,
    COUNT(DISTINCT v.question_id) as questions_with_votes,
    p.total_questions_answered
FROM profiles p
LEFT JOIN votes v ON v.target_username = p.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY p.username, p.total_questions_answered
ORDER BY total_votes DESC
LIMIT 10;

-- Get students currently on same question (real-time collaboration)
SELECT
    p.username,
    ua.activity_state,
    ua.last_activity
FROM user_activity ua
JOIN profiles p ON ua.username = p.username
WHERE ua.current_question_id = 'U1-L3-Q05'
AND ua.last_activity > NOW() - INTERVAL '10 minutes'
ORDER BY ua.last_activity DESC;

-- ============================================
-- ANALYTICS QUERIES
-- ============================================

-- Get engagement metrics over time
SELECT
    DATE(a.timestamp) as date,
    COUNT(DISTINCT a.username) as active_students,
    COUNT(*) as total_answers,
    AVG(a.time_spent_seconds) / 60 as avg_time_minutes
FROM answers a
JOIN profiles p ON a.username = p.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
AND a.timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(a.timestamp)
ORDER BY date DESC;

-- Get badge leaderboard
SELECT
    p.username,
    COUNT(b.id) as total_badges,
    STRING_AGG(b.badge_name, ', ' ORDER BY b.earned_at DESC) as recent_badges
FROM profiles p
JOIN badges b ON p.username = b.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY p.username
ORDER BY total_badges DESC, p.username
LIMIT 10;

-- Get time-on-task by unit
SELECT
    pr.unit_id,
    COUNT(DISTINCT pr.username) as students,
    SUM(pr.time_spent_seconds) / 3600.0 as total_hours,
    AVG(pr.time_spent_seconds) / 60.0 as avg_minutes_per_student,
    AVG(pr.completion_percentage) as avg_completion
FROM progress pr
JOIN profiles p ON pr.username = p.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY pr.unit_id
ORDER BY pr.unit_id;

-- ============================================
-- CHART WIZARD QUERIES
-- ============================================

-- Get chart-based answers for a question
SELECT
    username,
    answer_value,
    chart_data,
    timestamp
FROM answers
WHERE question_id = 'U1-L4-CHART01'
AND answer_type = 'chart-response'
AND chart_data IS NOT NULL
ORDER BY timestamp DESC;

-- Get all histograms created
SELECT
    username,
    question_id,
    chart_data->>'type' as chart_type,
    chart_data->'bins' as bins,
    chart_data->>'xLabel' as x_label,
    chart_data->>'yLabel' as y_label,
    timestamp
FROM answers
WHERE answer_type = 'chart-response'
AND chart_data->>'type' = 'histogram'
ORDER BY timestamp DESC
LIMIT 20;

-- ============================================
-- ADMINISTRATIVE QUERIES
-- ============================================

-- Get all classes taught by a teacher
SELECT
    cs.section_code,
    cs.section_name,
    COUNT(DISTINCT p.username) as student_count,
    cs.created_at,
    cs.settings
FROM class_sections cs
LEFT JOIN profiles p ON p.class_section_id = cs.id AND p.is_teacher = FALSE
WHERE cs.teacher_username = 'Teacher_Demo'
GROUP BY cs.id, cs.section_code, cs.section_name, cs.created_at, cs.settings
ORDER BY cs.created_at DESC;

-- Find inactive students (no activity in 7 days)
SELECT
    p.username,
    p.last_seen,
    p.total_questions_answered,
    EXTRACT(DAY FROM (NOW() - p.last_seen)) as days_inactive
FROM profiles p
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
AND p.is_teacher = FALSE
AND p.last_seen < NOW() - INTERVAL '7 days'
ORDER BY days_inactive DESC;

-- Get students who need help (low completion, high time)
SELECT
    p.username,
    AVG(pr.completion_percentage) as avg_completion,
    SUM(pr.time_spent_seconds) / 3600.0 as total_hours,
    COUNT(DISTINCT pr.unit_id) as units_attempted
FROM profiles p
JOIN progress pr ON p.username = pr.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY p.username
HAVING AVG(pr.completion_percentage) < 50
   AND SUM(pr.time_spent_seconds) / 3600.0 > 2
ORDER BY avg_completion ASC;

-- ============================================
-- PERFORMANCE QUERIES (with EXPLAIN)
-- ============================================

-- Verify index usage for peer answers query
EXPLAIN ANALYZE
SELECT * FROM answers
WHERE question_id = 'U1-L2-Q01';
-- Should use idx_answers_question

-- Verify index usage for student progress
EXPLAIN ANALYZE
SELECT * FROM progress
WHERE username = 'Apple_Penguin';
-- Should use idx_progress_username

-- Verify index usage for class students
EXPLAIN ANALYZE
SELECT * FROM profiles
WHERE class_section_id = (SELECT id FROM class_sections WHERE section_code = 'STATS2024');
-- Should use idx_profiles_class_section
