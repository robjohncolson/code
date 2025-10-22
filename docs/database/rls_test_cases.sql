-- ============================================
-- RLS Test Cases
-- Tests row-level security policies for all tables
-- ============================================

-- ============================================
-- SETUP TEST ENVIRONMENT
-- ============================================

-- Create test users (run this with service role)
INSERT INTO profiles (username, is_teacher) VALUES
('Test_Student1', FALSE),
('Test_Student2', FALSE),
('Test_Teacher', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Create test class
INSERT INTO class_sections (section_code, teacher_username, section_name) VALUES
('TEST101', 'Test_Teacher', 'Test Class')
ON CONFLICT (section_code) DO NOTHING;

-- Link students to class
UPDATE profiles
SET class_section_id = (SELECT id FROM class_sections WHERE section_code = 'TEST101')
WHERE username IN ('Test_Student1', 'Test_Student2');

-- ============================================
-- TEST 1: Profile Policies
-- ============================================

\echo '>>> Test 1.1: Users can view all profiles'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_positive FROM profiles;

\echo '>>> Test 1.2: Users can update own profile'
SET app.current_username = 'Test_Student1';
UPDATE profiles
SET current_unit = 'unit1'
WHERE username = 'Test_Student1';
-- Should succeed

\echo '>>> Test 1.3: Users CANNOT update other profiles'
SET app.current_username = 'Test_Student1';
UPDATE profiles
SET current_unit = 'unit2'
WHERE username = 'Test_Student2';
-- Should fail (0 rows updated)

\echo '>>> Test 1.4: Users CANNOT escalate to teacher'
SET app.current_username = 'Test_Student1';
UPDATE profiles
SET is_teacher = TRUE
WHERE username = 'Test_Student1';
-- Should fail with exception

-- ============================================
-- TEST 2: Answers Policies
-- ============================================

-- Insert test answers
INSERT INTO answers (username, question_id, answer_value) VALUES
('Test_Student1', 'Q1', 'A'),
('Test_Student2', 'Q1', 'B')
ON CONFLICT DO NOTHING;

\echo '>>> Test 2.1: Everyone can view all answers'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_2 FROM answers WHERE question_id = 'Q1';

\echo '>>> Test 2.2: Users can insert own answers'
SET app.current_username = 'Test_Student1';
INSERT INTO answers (username, question_id, answer_value, attempt_number)
VALUES ('Test_Student1', 'Q2', 'C', 1)
ON CONFLICT DO NOTHING;
-- Should succeed

\echo '>>> Test 2.3: Users CANNOT insert answers for others'
SET app.current_username = 'Test_Student1';
INSERT INTO answers (username, question_id, answer_value, attempt_number)
VALUES ('Test_Student2', 'Q2', 'D', 1)
ON CONFLICT DO NOTHING;
-- Should fail (policy violation)

\echo '>>> Test 2.4: Users can update own answers'
SET app.current_username = 'Test_Student1';
UPDATE answers
SET answer_value = 'B'
WHERE username = 'Test_Student1' AND question_id = 'Q1';
-- Should succeed

\echo '>>> Test 2.5: Users CANNOT update other answers'
SET app.current_username = 'Test_Student1';
UPDATE answers
SET answer_value = 'C'
WHERE username = 'Test_Student2' AND question_id = 'Q1';
-- Should fail (0 rows updated)

-- ============================================
-- TEST 3: Votes Policies
-- ============================================

\echo '>>> Test 3.1: Users can vote for others'
SET app.current_username = 'Test_Student1';
INSERT INTO votes (question_id, voter_username, target_username, vote_type)
VALUES ('Q1', 'Test_Student1', 'Test_Student2', 'helpful')
ON CONFLICT DO NOTHING;
-- Should succeed

\echo '>>> Test 3.2: Users CANNOT vote for themselves'
SET app.current_username = 'Test_Student1';
INSERT INTO votes (question_id, voter_username, target_username, vote_type)
VALUES ('Q1', 'Test_Student1', 'Test_Student1', 'helpful')
ON CONFLICT DO NOTHING;
-- Should fail (CHECK constraint violation)

\echo '>>> Test 3.3: Users CANNOT vote as someone else'
SET app.current_username = 'Test_Student1';
INSERT INTO votes (question_id, voter_username, target_username, vote_type)
VALUES ('Q1', 'Test_Student2', 'Test_Teacher', 'clear')
ON CONFLICT DO NOTHING;
-- Should fail (policy violation)

\echo '>>> Test 3.4: Everyone can view votes'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_positive FROM votes WHERE question_id = 'Q1';

\echo '>>> Test 3.5: Users can delete own votes'
SET app.current_username = 'Test_Student1';
DELETE FROM votes
WHERE voter_username = 'Test_Student1'
AND target_username = 'Test_Student2'
AND question_id = 'Q1';
-- Should succeed

-- ============================================
-- TEST 4: Progress Policies
-- ============================================

-- Insert test progress
INSERT INTO progress (username, unit_id, lesson_id, questions_completed, questions_total)
VALUES
('Test_Student1', 'unit1', 'lesson1', 5, 10),
('Test_Student2', 'unit1', 'lesson1', 8, 10)
ON CONFLICT DO NOTHING;

\echo '>>> Test 4.1: Users can view own progress'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_1 FROM progress WHERE username = 'Test_Student1';

\echo '>>> Test 4.2: Students CANNOT view other students progress'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_0_for_student2 FROM progress WHERE username = 'Test_Student2';

\echo '>>> Test 4.3: Teachers CAN view class progress'
SET app.current_username = 'Test_Teacher';
SELECT COUNT(*) AS should_be_2 FROM progress
WHERE username IN ('Test_Student1', 'Test_Student2');
-- Should see both students

\echo '>>> Test 4.4: Users can update own progress'
SET app.current_username = 'Test_Student1';
UPDATE progress
SET questions_completed = 7
WHERE username = 'Test_Student1' AND unit_id = 'unit1';
-- Should succeed

\echo '>>> Test 4.5: Users CANNOT update other progress'
SET app.current_username = 'Test_Student1';
UPDATE progress
SET questions_completed = 10
WHERE username = 'Test_Student2' AND unit_id = 'unit1';
-- Should fail (0 rows updated)

-- ============================================
-- TEST 5: Class Sections Policies
-- ============================================

\echo '>>> Test 5.1: Students can view their class'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_1 FROM class_sections WHERE section_code = 'TEST101';

\echo '>>> Test 5.2: Teachers can view classes they teach'
SET app.current_username = 'Test_Teacher';
SELECT COUNT(*) AS should_be_1 FROM class_sections WHERE teacher_username = 'Test_Teacher';

\echo '>>> Test 5.3: Students CANNOT create classes'
SET app.current_username = 'Test_Student1';
INSERT INTO class_sections (section_code, teacher_username, section_name)
VALUES ('FAKE999', 'Test_Student1', 'Fake Class');
-- Should fail (policy violation)

\echo '>>> Test 5.4: Teachers CAN create classes'
SET app.current_username = 'Test_Teacher';
INSERT INTO class_sections (section_code, teacher_username, section_name)
VALUES ('TEACH101', 'Test_Teacher', 'Teacher Class')
ON CONFLICT DO NOTHING;
-- Should succeed

\echo '>>> Test 5.5: Teachers can update own classes'
SET app.current_username = 'Test_Teacher';
UPDATE class_sections
SET section_name = 'Updated Name'
WHERE section_code = 'TEACH101';
-- Should succeed

-- ============================================
-- TEST 6: Badges Policies
-- ============================================

-- Insert test badge (as system/service role)
RESET app.current_username;
INSERT INTO badges (username, badge_type, badge_name)
VALUES ('Test_Student1', 'first_answer', 'First Steps')
ON CONFLICT DO NOTHING;

\echo '>>> Test 6.1: Everyone can view badges'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_1 FROM badges WHERE username = 'Test_Student1';

\echo '>>> Test 6.2: Students CANNOT grant badges'
SET app.current_username = 'Test_Student1';
INSERT INTO badges (username, badge_type, badge_name)
VALUES ('Test_Student1', 'fake_badge', 'Fake Badge');
-- Should fail (no INSERT policy for students)

\echo '>>> Test 6.3: Teachers CAN grant badges to their students'
SET app.current_username = 'Test_Teacher';
INSERT INTO badges (username, badge_type, badge_name)
VALUES ('Test_Student1', 'teacher_award', 'Teacher Award')
ON CONFLICT DO NOTHING;
-- Should succeed

-- ============================================
-- TEST 7: User Activity Policies
-- ============================================

-- Insert test activity
INSERT INTO user_activity (username, activity_state, current_question_id)
VALUES
('Test_Student1', 'answering', 'Q1'),
('Test_Student2', 'viewing', 'Q2')
ON CONFLICT (username) DO UPDATE SET activity_state = EXCLUDED.activity_state;

\echo '>>> Test 7.1: Everyone can view activity'
SET app.current_username = 'Test_Student1';
SELECT COUNT(*) AS should_be_positive FROM user_activity;

\echo '>>> Test 7.2: Users can update own activity'
SET app.current_username = 'Test_Student1';
UPDATE user_activity
SET activity_state = 'submitted'
WHERE username = 'Test_Student1';
-- Should succeed

\echo '>>> Test 7.3: Users CANNOT update other activity'
SET app.current_username = 'Test_Student1';
UPDATE user_activity
SET activity_state = 'idle'
WHERE username = 'Test_Student2';
-- Should fail (0 rows updated)

-- ============================================
-- CLEANUP
-- ============================================

\echo '>>> Cleaning up test data...'
RESET app.current_username;

DELETE FROM user_activity WHERE username LIKE 'Test_%';
DELETE FROM votes WHERE voter_username LIKE 'Test_%';
DELETE FROM badges WHERE username LIKE 'Test_%';
DELETE FROM answers WHERE username LIKE 'Test_%';
DELETE FROM progress WHERE username LIKE 'Test_%';
DELETE FROM class_sections WHERE section_code LIKE 'TEST%' OR section_code LIKE 'TEACH%';
DELETE FROM profiles WHERE username LIKE 'Test_%';

\echo '>>> RLS Test Cases Complete'
\echo '>>> Review output for any unexpected failures'
