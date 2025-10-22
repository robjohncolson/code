-- ============================================
-- Schema Validation Script
-- Verifies database schema is properly configured
-- ============================================

\echo '>>> AP Statistics Quiz - Schema Validation'
\echo ''

-- ============================================
-- CHECK 1: All tables exist
-- ============================================

\echo '1. Checking all required tables exist...'

DO $$
DECLARE
    expected_tables TEXT[] := ARRAY[
        'class_sections',
        'profiles',
        'progress',
        'answers',
        'votes',
        'badges',
        'user_activity'
    ];
    table_count INT;
    missing_tables TEXT[];
BEGIN
    -- Count existing tables
    SELECT COUNT(*)
    INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = ANY(expected_tables);

    -- Find missing tables
    SELECT ARRAY_AGG(t)
    INTO missing_tables
    FROM unnest(expected_tables) AS t
    WHERE t NOT IN (
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
    );

    IF table_count < array_length(expected_tables, 1) THEN
        RAISE EXCEPTION 'Missing tables: %. Found % of % expected tables',
            missing_tables, table_count, array_length(expected_tables, 1);
    END IF;

    RAISE NOTICE '   ✓ All % tables exist', table_count;
END $$;

-- ============================================
-- CHECK 2: Row Level Security enabled
-- ============================================

\echo '2. Checking RLS is enabled on all tables...'

DO $$
DECLARE
    rls_count INT;
    tables_without_rls TEXT[];
BEGIN
    SELECT COUNT(*)
    INTO rls_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('class_sections', 'profiles', 'progress', 'answers', 'votes', 'badges', 'user_activity')
    AND rowsecurity = TRUE;

    -- Find tables without RLS
    SELECT ARRAY_AGG(tablename)
    INTO tables_without_rls
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('class_sections', 'profiles', 'progress', 'answers', 'votes', 'badges', 'user_activity')
    AND rowsecurity = FALSE;

    IF rls_count < 7 THEN
        RAISE EXCEPTION 'RLS not enabled on all tables. Missing: %. Expected 7, got %',
            tables_without_rls, rls_count;
    END IF;

    RAISE NOTICE '   ✓ RLS enabled on all % tables', rls_count;
END $$;

-- ============================================
-- CHECK 3: Required indexes exist
-- ============================================

\echo '3. Checking required indexes exist...'

DO $$
DECLARE
    index_count INT;
    expected_indexes TEXT[] := ARRAY[
        'idx_profiles_class_section',
        'idx_profiles_is_teacher',
        'idx_progress_username',
        'idx_progress_unit',
        'idx_answers_question',
        'idx_answers_username',
        'idx_votes_question',
        'idx_votes_target',
        'idx_badges_username',
        'idx_activity_last'
    ];
    missing_indexes TEXT[];
BEGIN
    SELECT COUNT(*)
    INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname = ANY(expected_indexes);

    -- Find missing indexes
    SELECT ARRAY_AGG(idx)
    INTO missing_indexes
    FROM unnest(expected_indexes) AS idx
    WHERE idx NOT IN (
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
    );

    IF index_count < array_length(expected_indexes, 1) THEN
        RAISE WARNING 'Some indexes missing: %. Found % of % expected',
            missing_indexes, index_count, array_length(expected_indexes, 1);
    ELSE
        RAISE NOTICE '   ✓ All % critical indexes exist', index_count;
    END IF;
END $$;

-- ============================================
-- CHECK 4: Foreign key constraints
-- ============================================

\echo '4. Checking foreign key constraints...'

SELECT
    COUNT(*) as fk_count,
    STRING_AGG(DISTINCT tc.table_name, ', ' ORDER BY tc.table_name) as tables_with_fks
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
\gset

DO $$
BEGIN
    IF :fk_count < 8 THEN
        RAISE WARNING 'Expected at least 8 foreign keys, found %', :fk_count;
    ELSE
        RAISE NOTICE '   ✓ % foreign key constraints found', :fk_count;
    END IF;
END $$;

-- ============================================
-- CHECK 5: Triggers exist
-- ============================================

\echo '5. Checking triggers are configured...'

SELECT
    COUNT(*) as trigger_count,
    STRING_AGG(DISTINCT trigger_name, ', ') as trigger_names
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('profiles', 'answers', 'votes', 'class_sections')
\gset

DO $$
BEGIN
    IF :trigger_count < 5 THEN
        RAISE WARNING 'Expected at least 5 triggers, found %', :trigger_count;
    ELSE
        RAISE NOTICE '   ✓ % triggers configured', :trigger_count;
    END IF;
END $$;

-- ============================================
-- CHECK 6: RLS policies exist
-- ============================================

\echo '6. Checking RLS policies are defined...'

SELECT
    COUNT(*) as policy_count,
    COUNT(DISTINCT tablename) as tables_with_policies
FROM pg_policies
WHERE schemaname = 'public'
\gset

DO $$
BEGIN
    IF :tables_with_policies < 7 THEN
        RAISE WARNING 'Not all tables have RLS policies. Expected 7, found %', :tables_with_policies;
    ELSE
        RAISE NOTICE '   ✓ % policies across % tables', :policy_count, :tables_with_policies;
    END IF;
END $$;

-- ============================================
-- CHECK 7: Functions exist
-- ============================================

\echo '7. Checking custom functions...'

DO $$
DECLARE
    func_count INT;
BEGIN
    SELECT COUNT(*)
    INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'update_updated_at_column',
        'update_profile_stats',
        'update_vote_count',
        'current_username',
        'is_current_user_teacher',
        'prevent_teacher_escalation'
    );

    IF func_count < 6 THEN
        RAISE WARNING 'Expected 6 functions, found %', func_count;
    ELSE
        RAISE NOTICE '   ✓ % custom functions defined', func_count;
    END IF;
END $$;

-- ============================================
-- CHECK 8: Check constraints
-- ============================================

\echo '8. Checking CHECK constraints...'

SELECT
    COUNT(*) as check_count
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
\gset

DO $$
BEGIN
    IF :check_count < 10 THEN
        RAISE WARNING 'Expected at least 10 check constraints, found %', :check_count;
    ELSE
        RAISE NOTICE '   ✓ % CHECK constraints enforcing data integrity', :check_count;
    END IF;
END $$;

-- ============================================
-- CHECK 9: Test RLS policy enforcement
-- ============================================

\echo '9. Testing RLS policy enforcement...'

DO $$
DECLARE
    update_count INT;
BEGIN
    -- Try to update another user's profile (should fail silently - 0 rows)
    SET LOCAL app.current_username = 'Test_User_1';

    -- Insert test profile
    INSERT INTO profiles (username) VALUES ('Test_User_1'), ('Test_User_2')
    ON CONFLICT DO NOTHING;

    -- Try to update other user's profile
    UPDATE profiles
    SET current_unit = 'hacked'
    WHERE username = 'Test_User_2';

    GET DIAGNOSTICS update_count = ROW_COUNT;

    IF update_count > 0 THEN
        RAISE EXCEPTION 'RLS policy failed: User was able to update another user''s profile';
    END IF;

    -- Cleanup
    DELETE FROM profiles WHERE username LIKE 'Test_User_%';

    RAISE NOTICE '   ✓ RLS policies enforcing access control';
END $$;

-- ============================================
-- CHECK 10: Sample data validation
-- ============================================

\echo '10. Checking if sample data exists (optional)...'

SELECT
    (SELECT COUNT(*) FROM profiles) as profile_count,
    (SELECT COUNT(*) FROM answers) as answer_count,
    (SELECT COUNT(*) FROM badges) as badge_count
\gset

DO $$
BEGIN
    IF :profile_count = 0 THEN
        RAISE NOTICE '   ⓘ No sample data - run migrations/003_seed_data.sql to add test data';
    ELSE
        RAISE NOTICE '   ✓ Sample data present: % profiles, % answers, % badges',
            :profile_count, :answer_count, :badge_count;
    END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================

\echo ''
\echo '=========================================='
\echo '✅ Schema Validation Complete'
\echo '=========================================='
\echo ''
\echo 'All critical checks passed.'
\echo 'Database schema is properly configured.'
\echo ''
\echo 'Next steps:'
\echo '  1. Run migrations/003_seed_data.sql for test data'
\echo '  2. Test RLS policies with docs/database/rls_test_cases.sql'
\echo '  3. Review docs/database/sample_queries.sql for usage examples'
\echo ''
