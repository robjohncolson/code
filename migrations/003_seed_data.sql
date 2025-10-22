-- ============================================
-- Migration 003: Seed Data
-- Created: 2025-10-22
-- Description: Sample data for testing and development
-- ============================================

BEGIN;

-- ============================================
-- CLASS SECTIONS
-- ============================================

INSERT INTO class_sections (section_code, teacher_username, section_name, settings) VALUES
('STATS2024', 'Teacher_Demo', 'AP Statistics Period 3', '{"peer_visibility": true, "voting_enabled": true, "chart_wizard_enabled": true}'::jsonb),
('STATS2024B', 'Teacher_Demo', 'AP Statistics Period 5', '{"peer_visibility": true, "voting_enabled": true, "chart_wizard_enabled": false}'::jsonb)
ON CONFLICT (section_code) DO NOTHING;

-- ============================================
-- PROFILES (Students and Teachers)
-- ============================================

-- Teacher profile
INSERT INTO profiles (username, is_teacher, total_questions_answered, current_unit) VALUES
('Teacher_Demo', TRUE, 0, NULL)
ON CONFLICT (username) DO NOTHING;

-- Student profiles with anonymous usernames
INSERT INTO profiles (username, total_questions_answered, current_unit, current_question, class_section_id) VALUES
('Apple_Penguin', 45, 'unit1', 'U1-L3-Q05', (SELECT id FROM class_sections WHERE section_code = 'STATS2024')),
('Banana_Koala', 38, 'unit1', 'U1-L2-Q08', (SELECT id FROM class_sections WHERE section_code = 'STATS2024')),
('Cherry_Tiger', 52, 'unit2', 'U2-L1-Q03', (SELECT id FROM class_sections WHERE section_code = 'STATS2024')),
('Mango_Panda', 29, 'unit1', 'U1-L2-Q01', (SELECT id FROM class_sections WHERE section_code = 'STATS2024')),
('Orange_Dolphin', 41, 'unit1', 'U1-L3-Q02', (SELECT id FROM class_sections WHERE section_code = 'STATS2024')),
('Grape_Fox', 15, 'unit1', 'U1-L1-Q05', (SELECT id FROM class_sections WHERE section_code = 'STATS2024B')),
('Kiwi_Owl', 22, 'unit1', 'U1-L2-Q03', (SELECT id FROM class_sections WHERE section_code = 'STATS2024B')),
('Lemon_Bear', 33, 'unit1', 'U1-L2-Q10', (SELECT id FROM class_sections WHERE section_code = 'STATS2024B'))
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- PROGRESS TRACKING
-- ============================================

INSERT INTO progress (username, unit_id, lesson_id, questions_completed, questions_total, completion_percentage, time_spent_seconds) VALUES
-- Apple_Penguin progress
('Apple_Penguin', 'unit1', 'lesson1', 10, 10, 100.00, 1200),
('Apple_Penguin', 'unit1', 'lesson2', 8, 10, 80.00, 950),
('Apple_Penguin', 'unit1', 'lesson3', 5, 12, 41.67, 600),

-- Banana_Koala progress
('Banana_Koala', 'unit1', 'lesson1', 10, 10, 100.00, 1100),
('Banana_Koala', 'unit1', 'lesson2', 10, 10, 100.00, 1300),
('Banana_Koala', 'unit1', 'lesson3', 3, 12, 25.00, 400),

-- Cherry_Tiger progress
('Cherry_Tiger', 'unit1', 'lesson1', 10, 10, 100.00, 1000),
('Cherry_Tiger', 'unit1', 'lesson2', 10, 10, 100.00, 1150),
('Cherry_Tiger', 'unit1', 'lesson3', 12, 12, 100.00, 1400),
('Cherry_Tiger', 'unit2', 'lesson1', 4, 15, 26.67, 500),

-- Mango_Panda progress
('Mango_Panda', 'unit1', 'lesson1', 10, 10, 100.00, 1250),
('Mango_Panda', 'unit1', 'lesson2', 6, 10, 60.00, 700),

-- Orange_Dolphin progress
('Orange_Dolphin', 'unit1', 'lesson1', 10, 10, 100.00, 1050),
('Orange_Dolphin', 'unit1', 'lesson2', 9, 10, 90.00, 1100),
('Orange_Dolphin', 'unit1', 'lesson3', 7, 12, 58.33, 800)
ON CONFLICT (username, unit_id, lesson_id) DO NOTHING;

-- ============================================
-- ANSWERS (Multiple Choice & FRQ)
-- ============================================

-- Question U1-L2-Q01 - Multiple students answering same question
INSERT INTO answers (username, question_id, answer_value, answer_type, reasoning, is_correct, time_spent_seconds) VALUES
('Apple_Penguin', 'U1-L2-Q01', 'B', 'multiple-choice', 'The median is resistant to outliers, while the mean is not.', TRUE, 45),
('Banana_Koala', 'U1-L2-Q01', 'B', 'multiple-choice', 'Outliers don''t affect the median significantly.', TRUE, 38),
('Cherry_Tiger', 'U1-L2-Q01', 'C', 'multiple-choice', 'The mean is better for normal distributions without outliers.', FALSE, 42),
('Mango_Panda', 'U1-L2-Q01', 'B', 'multiple-choice', 'Median is the middle value and not influenced by extreme values.', TRUE, 50),
('Orange_Dolphin', 'U1-L2-Q01', 'A', 'multiple-choice', 'Mode shows the most common value.', FALSE, 35)
ON CONFLICT DO NOTHING;

-- Question U1-L2-Q05 - Mix of answers
INSERT INTO answers (username, question_id, answer_value, answer_type, reasoning, is_correct) VALUES
('Apple_Penguin', 'U1-L2-Q05', 'D', 'multiple-choice', 'IQR is calculated as Q3 - Q1.', TRUE),
('Banana_Koala', 'U1-L2-Q05', 'D', 'multiple-choice', 'The interquartile range measures spread.', TRUE),
('Cherry_Tiger', 'U1-L2-Q05', 'B', 'multiple-choice', 'Range includes all values.', FALSE),
('Mango_Panda', 'U1-L2-Q05', 'D', 'multiple-choice', 'Q3 minus Q1 gives the IQR.', TRUE)
ON CONFLICT DO NOTHING;

-- Free response question
INSERT INTO answers (username, question_id, answer_value, answer_type, reasoning, time_spent_seconds) VALUES
('Apple_Penguin', 'U1-L3-FRQ01', 'The distribution is right-skewed with a median of 25 and IQR of 15. There are two outliers at 80 and 85.', 'free-response', NULL, 180),
('Banana_Koala', 'U1-L3-FRQ01', 'Shape: Skewed right. Center: Median = 25. Spread: IQR = 15. Outliers: 80, 85.', 'free-response', NULL, 165),
('Cherry_Tiger', 'U1-L3-FRQ01', 'Right-skewed distribution. Center around 25. Large spread with outliers.', 'free-response', NULL, 140)
ON CONFLICT DO NOTHING;

-- Chart question (histogram)
INSERT INTO answers (username, question_id, answer_value, answer_type, chart_data) VALUES
('Apple_Penguin', 'U1-L4-CHART01', 'histogram', 'chart-response',
'{"type": "histogram", "version": "0.1", "xLabel": "Test Score", "yLabel": "Frequency", "bins": [{"start": 60, "end": 70, "frequency": 3}, {"start": 70, "end": 80, "frequency": 8}, {"start": 80, "end": 90, "frequency": 12}, {"start": 90, "end": 100, "frequency": 7}]}'::jsonb),
('Banana_Koala', 'U1-L4-CHART01', 'histogram', 'chart-response',
'{"type": "histogram", "version": "0.1", "xLabel": "Score", "yLabel": "Count", "bins": [{"start": 60, "end": 70, "frequency": 4}, {"start": 70, "end": 80, "frequency": 9}, {"start": 80, "end": 90, "frequency": 11}, {"start": 90, "end": 100, "frequency": 6}]}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- VOTES (Peer Voting)
-- ============================================

INSERT INTO votes (question_id, voter_username, target_username, vote_type) VALUES
-- Votes for U1-L2-Q01 answers
('U1-L2-Q01', 'Apple_Penguin', 'Banana_Koala', 'helpful'),
('U1-L2-Q01', 'Cherry_Tiger', 'Apple_Penguin', 'clear'),
('U1-L2-Q01', 'Mango_Panda', 'Banana_Koala', 'helpful'),
('U1-L2-Q01', 'Orange_Dolphin', 'Apple_Penguin', 'helpful'),
('U1-L2-Q01', 'Banana_Koala', 'Mango_Panda', 'clear'),

-- Votes for FRQ
('U1-L3-FRQ01', 'Banana_Koala', 'Apple_Penguin', 'clear'),
('U1-L3-FRQ01', 'Cherry_Tiger', 'Banana_Koala', 'helpful'),
('U1-L3-FRQ01', 'Apple_Penguin', 'Cherry_Tiger', 'insightful'),

-- Votes for U1-L2-Q05
('U1-L2-Q05', 'Cherry_Tiger', 'Mango_Panda', 'helpful'),
('U1-L2-Q05', 'Mango_Panda', 'Apple_Penguin', 'clear'),
('U1-L2-Q05', 'Apple_Penguin', 'Banana_Koala', 'helpful')
ON CONFLICT DO NOTHING;

-- ============================================
-- BADGES (Achievements)
-- ============================================

INSERT INTO badges (username, badge_type, badge_name, badge_description, metadata) VALUES
-- First answer badge
('Apple_Penguin', 'first_answer', 'First Steps', 'Submitted your first answer', '{"unit": "unit1", "question": "U1-L2-Q01"}'::jsonb),
('Banana_Koala', 'first_answer', 'First Steps', 'Submitted your first answer', '{"unit": "unit1", "question": "U1-L1-Q01"}'::jsonb),
('Cherry_Tiger', 'first_answer', 'First Steps', 'Submitted your first answer', '{"unit": "unit1", "question": "U1-L1-Q01"}'::jsonb),

-- Perfect lesson badge
('Banana_Koala', 'perfect_lesson', 'Perfect Score', 'Scored 100% on a lesson', '{"lesson": "U1-L2", "score": 100}'::jsonb),
('Cherry_Tiger', 'perfect_lesson', 'Perfect Score', 'Scored 100% on a lesson', '{"lesson": "U1-L3", "score": 100}'::jsonb),

-- Helpful peer badge (5+ votes received)
('Apple_Penguin', 'helpful_peer', 'Helpful Peer', 'Received 5+ helpful votes', '{"votes_received": 5}'::jsonb),
('Banana_Koala', 'helpful_peer', 'Helpful Peer', 'Received 5+ helpful votes', '{"votes_received": 6}'::jsonb),

-- Unit completion badge
('Cherry_Tiger', 'unit_complete', 'Unit Master', 'Completed all lessons in Unit 1', '{"unit": "unit1", "completion": 100}'::jsonb),

-- Early bird badge (answered in first 10 students)
('Apple_Penguin', 'early_bird', 'Early Bird', 'One of the first 10 to answer', '{"question": "U1-L2-Q01", "rank": 3}'::jsonb),

-- Streak badge
('Banana_Koala', 'answer_streak', 'On Fire!', 'Answered questions 5 days in a row', '{"days": 5}'::jsonb)
ON CONFLICT (username, badge_type) DO NOTHING;

-- ============================================
-- USER ACTIVITY (Presence)
-- ============================================

INSERT INTO user_activity (username, activity_state, current_question_id, last_activity, session_id) VALUES
('Apple_Penguin', 'answering', 'U1-L3-Q05', NOW() - INTERVAL '2 minutes', gen_random_uuid()),
('Banana_Koala', 'viewing', 'U1-L2-Q08', NOW() - INTERVAL '5 minutes', gen_random_uuid()),
('Cherry_Tiger', 'reviewing_peers', 'U2-L1-Q03', NOW() - INTERVAL '1 minute', gen_random_uuid()),
('Mango_Panda', 'submitted', 'U1-L2-Q01', NOW() - INTERVAL '10 minutes', gen_random_uuid()),
('Orange_Dolphin', 'answering', 'U1-L3-Q02', NOW() - INTERVAL '3 minutes', gen_random_uuid()),
('Grape_Fox', 'idle', NULL, NOW() - INTERVAL '30 minutes', gen_random_uuid()),
('Kiwi_Owl', 'viewing', 'U1-L2-Q03', NOW() - INTERVAL '15 minutes', gen_random_uuid())
ON CONFLICT (username) DO UPDATE SET
    activity_state = EXCLUDED.activity_state,
    current_question_id = EXCLUDED.current_question_id,
    last_activity = EXCLUDED.last_activity,
    session_id = EXCLUDED.session_id;

COMMIT;

-- Verify seed data
DO $$
DECLARE
    profile_count INT;
    answer_count INT;
    badge_count INT;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM profiles WHERE username LIKE '%\_%';
    SELECT COUNT(*) INTO answer_count FROM answers;
    SELECT COUNT(*) INTO badge_count FROM badges;

    RAISE NOTICE 'Seed data summary:';
    RAISE NOTICE '  Profiles: %', profile_count;
    RAISE NOTICE '  Answers: %', answer_count;
    RAISE NOTICE '  Badges: %', badge_count;
    RAISE NOTICE 'Migration 003 completed successfully';
END $$;
