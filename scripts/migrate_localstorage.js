/**
 * localStorage to Supabase Migration Script
 * Migrates existing localStorage data to Supabase cloud storage
 * Run this in the browser console or as part of app initialization
 */

/**
 * Main migration function
 * @param {object} supabase - Initialized Supabase client
 * @param {object} options - Migration options
 * @returns {Promise<object>} Migration results
 */
async function migrateToSupabase(supabase, options = {}) {
    const {
        dryRun = false,      // If true, only simulate migration
        skipErrors = true,    // Continue on individual errors
        batchSize = 50       // Number of records per batch
    } = options;

    console.log('🔄 Starting localStorage → Supabase migration...');
    console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

    const results = {
        profiles: { success: 0, failed: 0, errors: [] },
        answers: { success: 0, failed: 0, errors: [] },
        progress: { success: 0, failed: 0, errors: [] },
        activity: { success: 0, failed: 0, errors: [] }
    };

    try {
        // Load classData from localStorage
        const classDataStr = localStorage.getItem('classData');
        if (!classDataStr) {
            console.warn('⚠️ No classData found in localStorage');
            return results;
        }

        const classData = JSON.parse(classDataStr);
        const users = classData.users || {};
        const usernames = Object.keys(users);

        console.log(`📊 Found ${usernames.length} users in localStorage`);

        // ============================================
        // MIGRATE PROFILES
        // ============================================
        console.log('\n📝 Migrating profiles...');

        for (const username of usernames) {
            try {
                const userData = users[username];

                const profile = {
                    username,
                    total_questions_answered: Object.keys(userData.answers || {}).length,
                    total_votes_received: 0, // Will be calculated from votes table
                    current_unit: userData.currentActivity?.questionId?.match(/U(\d+)/)?.[0]?.toLowerCase(),
                    current_question: userData.currentActivity?.questionId,
                    last_seen: new Date(),
                    metadata: {}
                };

                if (!dryRun) {
                    const { error } = await supabase
                        .from('profiles')
                        .upsert(profile, { onConflict: 'username' });

                    if (error) throw error;
                }

                results.profiles.success++;
                console.log(`  ✓ ${username}`);
            } catch (error) {
                results.profiles.failed++;
                results.profiles.errors.push({ username, error: error.message });
                console.error(`  ✗ ${username}: ${error.message}`);

                if (!skipErrors) throw error;
            }
        }

        // ============================================
        // MIGRATE ANSWERS
        // ============================================
        console.log('\n📝 Migrating answers...');

        let answerBatch = [];

        for (const username of usernames) {
            const userData = users[username];
            const userAnswers = userData.answers || {};

            for (const [questionId, answerData] of Object.entries(userAnswers)) {
                try {
                    // Handle both old and new answer formats
                    const answerValue = typeof answerData === 'string'
                        ? answerData
                        : answerData.value;

                    const timestamp = typeof answerData === 'object' && answerData.timestamp
                        ? new Date(answerData.timestamp)
                        : new Date();

                    const answer = {
                        username,
                        question_id: questionId,
                        attempt_number: userData.attempts?.[questionId] || 1,
                        answer_value: answerValue,
                        answer_type: 'multiple-choice', // Default, will be updated by app
                        timestamp,
                        reasoning: userData.reasons?.[questionId] || null,
                        created_at: timestamp,
                        updated_at: timestamp
                    };

                    answerBatch.push(answer);

                    // Insert in batches
                    if (answerBatch.length >= batchSize) {
                        if (!dryRun) {
                            const { error } = await supabase
                                .from('answers')
                                .upsert(answerBatch, {
                                    onConflict: 'username,question_id,attempt_number'
                                });

                            if (error) throw error;
                        }

                        results.answers.success += answerBatch.length;
                        console.log(`  ✓ Batch of ${answerBatch.length} answers`);
                        answerBatch = [];
                    }
                } catch (error) {
                    results.answers.failed++;
                    results.answers.errors.push({
                        username,
                        questionId,
                        error: error.message
                    });
                    console.error(`  ✗ ${username}/${questionId}: ${error.message}`);

                    if (!skipErrors) throw error;
                }
            }
        }

        // Insert remaining answers
        if (answerBatch.length > 0 && !dryRun) {
            const { error } = await supabase
                .from('answers')
                .upsert(answerBatch, {
                    onConflict: 'username,question_id,attempt_number'
                });

            if (!error) {
                results.answers.success += answerBatch.length;
                console.log(`  ✓ Final batch of ${answerBatch.length} answers`);
            } else {
                results.answers.failed += answerBatch.length;
                console.error(`  ✗ Final batch failed: ${error.message}`);
            }
        }

        // ============================================
        // MIGRATE USER ACTIVITY
        // ============================================
        console.log('\n📝 Migrating user activity...');

        for (const username of usernames) {
            try {
                const userData = users[username];
                const activity = userData.currentActivity;

                if (activity) {
                    const activityRecord = {
                        username,
                        activity_state: activity.state || 'idle',
                        current_question_id: activity.questionId || null,
                        last_activity: activity.lastUpdate
                            ? new Date(activity.lastUpdate)
                            : new Date(),
                        session_id: crypto.randomUUID?.() || null
                    };

                    if (!dryRun) {
                        const { error } = await supabase
                            .from('user_activity')
                            .upsert(activityRecord, { onConflict: 'username' });

                        if (error) throw error;
                    }

                    results.activity.success++;
                    console.log(`  ✓ ${username}`);
                }
            } catch (error) {
                results.activity.failed++;
                results.activity.errors.push({ username, error: error.message });
                console.error(`  ✗ ${username}: ${error.message}`);

                if (!skipErrors) throw error;
            }
        }

        // ============================================
        // SUMMARY
        // ============================================
        console.log('\n' + '='.repeat(50));
        console.log('📊 Migration Summary');
        console.log('='.repeat(50));
        console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE'}`);
        console.log('\nProfiles:');
        console.log(`  ✓ Success: ${results.profiles.success}`);
        console.log(`  ✗ Failed: ${results.profiles.failed}`);
        console.log('\nAnswers:');
        console.log(`  ✓ Success: ${results.answers.success}`);
        console.log(`  ✗ Failed: ${results.answers.failed}`);
        console.log('\nActivity:');
        console.log(`  ✓ Success: ${results.activity.success}`);
        console.log(`  ✗ Failed: ${results.activity.failed}`);

        if (results.profiles.failed + results.answers.failed + results.activity.failed > 0) {
            console.log('\n⚠️ Errors encountered:');
            [...results.profiles.errors, ...results.answers.errors, ...results.activity.errors]
                .slice(0, 10)
                .forEach(err => console.log(`  - ${JSON.stringify(err)}`));
        }

        if (dryRun) {
            console.log('\n💡 This was a dry run. Run with dryRun=false to apply changes.');
        } else {
            console.log('\n✅ Migration complete!');
            console.log('💡 Your localStorage data is now in Supabase.');
            console.log('🔒 Keep localStorage as backup until verified.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }

    return results;
}

/**
 * Verify migration was successful
 * @param {object} supabase - Initialized Supabase client
 * @returns {Promise<object>} Verification results
 */
async function verifyMigration(supabase) {
    console.log('\n🔍 Verifying migration...');

    const localData = JSON.parse(localStorage.getItem('classData') || '{}');
    const localUsernames = Object.keys(localData.users || {});

    // Check profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('username')
        .in('username', localUsernames);

    // Check answers
    const { count: answersCount, error: answersError } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .in('username', localUsernames);

    const localAnswersCount = localUsernames.reduce((total, username) => {
        return total + Object.keys(localData.users[username].answers || {}).length;
    }, 0);

    console.log('Results:');
    console.log(`  Profiles in Supabase: ${profiles?.length || 0} / ${localUsernames.length}`);
    console.log(`  Answers in Supabase: ${answersCount || 0} / ${localAnswersCount}`);

    const success = profiles?.length === localUsernames.length &&
                    answersCount === localAnswersCount;

    if (success) {
        console.log('✅ Verification passed!');
    } else {
        console.log('⚠️ Verification found discrepancies');
    }

    return { success, profiles: profiles?.length, answers: answersCount };
}

/**
 * Export for use in browser or Node.js
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { migrateToSupabase, verifyMigration };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.migrateToSupabase = migrateToSupabase;
    window.verifyMigration = verifyMigration;
}

// Usage example:
/*
// In browser console after loading app:
const results = await migrateToSupabase(supabase, { dryRun: true });
// Review results, then run for real:
const results = await migrateToSupabase(supabase, { dryRun: false });
// Verify:
await verifyMigration(supabase);
*/
