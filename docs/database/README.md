# Database Schema Documentation

## Overview
This directory contains the complete database schema, migrations, and documentation for the AP Statistics Consensus Quiz Supabase database.

**Schema Version:** 2.0
**Last Updated:** 2025-10-22
**Database:** PostgreSQL 14+ (Supabase)

## Quick Start

### 1. Apply Migrations

Run migrations in order:

```bash
# Connect to your Supabase database
psql $DATABASE_URL

# Run migrations
\i migrations/001_core_tables.sql
\i migrations/002_rls_policies.sql
\i migrations/003_seed_data.sql

# Validate
\i scripts/validate_schema.sql
```

### 2. Test RLS Policies

```bash
psql $DATABASE_URL -f docs/database/rls_test_cases.sql
```

### 3. Explore Sample Queries

```bash
psql $DATABASE_URL -f docs/database/sample_queries.sql
```

## File Structure

```
docs/database/
├── README.md                    # This file
├── schema_v2.sql               # Complete schema (reference)
├── erd_diagram.md              # Entity-relationship diagram
├── rls_test_cases.sql          # RLS policy test suite
├── sample_queries.sql          # Common query patterns
└── performance_baseline.md     # Performance targets

migrations/
├── 001_core_tables.sql         # Tables, indexes, triggers
├── 002_rls_policies.sql        # Row-level security
└── 003_seed_data.sql           # Sample test data

scripts/
├── validate_schema.sql         # Schema validation checks
└── migrate_localstorage.js     # localStorage → Supabase migration

.github/workflows/
└── db_migration.yml            # CI/CD for migrations
```

## Tables

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| **class_sections** | Class grouping | Teacher management, settings |
| **profiles** | User profiles | Anonymous usernames, stats |
| **progress** | Learning progress | Unit/lesson tracking |
| **answers** | Quiz responses | Multi-attempt, chart support |
| **votes** | Peer voting | Consensus building |
| **badges** | Achievements | Engagement rewards |
| **user_activity** | Real-time presence | Current activity tracking |

### Relationships

```
class_sections (1) ──< (N) profiles
profiles (1) ──< (N) progress
profiles (1) ──< (N) answers
profiles (1) ──< (N) votes (as voter)
profiles (1) ──< (N) votes (as target)
profiles (1) ──< (N) badges
profiles (1) ── (1) user_activity
```

## Key Features

### 1. Anonymous Authentication
- No PII stored
- Usernames in Fruit_Animal format (e.g., `Apple_Penguin`)
- Username is primary identifier
- No passwords, sessions, or JWT tokens (client-side)

### 2. Row-Level Security (RLS)
All tables have RLS policies enforcing:
- Users see own data + peer data (for collaboration)
- Teachers see class data
- No privilege escalation
- System-only operations (badge granting)

### 3. Performance Optimization
- 20+ indexes on foreign keys and common queries
- Partial indexes with WHERE clauses
- Views for common aggregations
- Triggers for auto-updates

### 4. Data Integrity
- Foreign key constraints with CASCADE deletes
- CHECK constraints on all fields
- UNIQUE constraints preventing duplicates
- Triggers maintaining computed fields

## Common Operations

### For Students

**Submit an answer:**
```sql
INSERT INTO answers (username, question_id, answer_value, reasoning)
VALUES ('Apple_Penguin', 'U1-L2-Q01', 'B', 'The median is resistant to outliers')
ON CONFLICT (username, question_id, attempt_number)
DO UPDATE SET answer_value = EXCLUDED.answer_value;
```

**Vote for a peer:**
```sql
INSERT INTO votes (question_id, voter_username, target_username, vote_type)
VALUES ('U1-L2-Q01', 'Apple_Penguin', 'Banana_Koala', 'helpful')
ON CONFLICT DO NOTHING;
```

**Update progress:**
```sql
INSERT INTO progress (username, unit_id, lesson_id, questions_completed, questions_total)
VALUES ('Apple_Penguin', 'unit1', 'lesson2', 8, 10)
ON CONFLICT (username, unit_id, lesson_id)
DO UPDATE SET
    questions_completed = EXCLUDED.questions_completed,
    completion_percentage = (EXCLUDED.questions_completed::DECIMAL / EXCLUDED.questions_total) * 100,
    last_activity = NOW();
```

### For Teachers

**View class summary:**
```sql
SELECT * FROM class_summary
WHERE section_code = 'STATS2024';
```

**See student progress:**
```sql
SELECT
    p.username,
    COUNT(DISTINCT pr.unit_id) as units_started,
    AVG(pr.completion_percentage) as avg_completion
FROM profiles p
LEFT JOIN progress pr ON p.username = pr.username
WHERE p.class_section_id = (SELECT id FROM class_sections WHERE section_code = 'STATS2024')
GROUP BY p.username
ORDER BY avg_completion DESC;
```

## Migration from localStorage

Use the provided migration script to move existing data to Supabase:

```javascript
// In browser console:
await migrateToSupabase(supabase, { dryRun: true });  // Test first
await migrateToSupabase(supabase, { dryRun: false }); // Apply
await verifyMigration(supabase);                       // Verify
```

See `scripts/migrate_localstorage.js` for details.

## Security Model

### RLS Policies Summary

| Table | Read | Write | Delete |
|-------|------|-------|--------|
| **profiles** | All users | Own only | System only |
| **progress** | Own + teachers | Own only | Own only |
| **answers** | All users | Own only | Own only |
| **votes** | All users | Own votes (not self) | Own votes |
| **badges** | All users | Teachers/system | System only |
| **class_sections** | Members/teachers | Teachers only | Teachers only |
| **user_activity** | All users | Own only | Own only |

### Username Context

RLS policies check current username via:
```sql
current_setting('request.jwt.claims.username', true)
```

For testing, set:
```sql
SET app.current_username = 'Test_User';
```

## Performance

### Target Response Times
- Profile lookup: < 10ms
- Progress query: < 20ms
- Peer answers (30 students): < 50ms
- Class summary (30 students): < 100ms

### Index Usage Validation

Check if queries use indexes:
```sql
EXPLAIN ANALYZE
SELECT * FROM answers WHERE question_id = 'U1-L2-Q01';
-- Should show: Index Scan using idx_answers_question
```

See `performance_baseline.md` for full benchmarks.

## Troubleshooting

### Issue: "Permission denied for table X"
**Cause:** RLS policy blocking access
**Solution:** Check current username context and RLS policies

### Issue: "Slow queries"
**Cause:** Missing or unused indexes
**Solution:** Run `EXPLAIN ANALYZE` and verify index usage

### Issue: "Duplicate key violation"
**Cause:** Unique constraint conflict
**Solution:** Use `ON CONFLICT` clause in INSERT statements

### Issue: "Foreign key constraint violation"
**Cause:** Referenced record doesn't exist
**Solution:** Ensure profile exists before inserting related data

## CI/CD

Migrations are automatically validated on PR via GitHub Actions:
- `.github/workflows/db_migration.yml`

Checks:
- ✅ All tables created
- ✅ RLS enabled
- ✅ Indexes exist
- ✅ Sample queries run
- ✅ Performance acceptable

## Development Workflow

1. **Make schema changes:**
   - Create new migration file: `migrations/004_your_change.sql`
   - Update `schema_v2.sql` reference doc

2. **Test locally:**
   ```bash
   psql $LOCAL_DB -f migrations/004_your_change.sql
   psql $LOCAL_DB -f scripts/validate_schema.sql
   ```

3. **Update documentation:**
   - ERD diagram if relationships changed
   - Sample queries if new patterns added
   - Performance baseline if new indexes

4. **Commit and PR:**
   - CI will validate migrations
   - Review plan with `EXPLAIN ANALYZE`
   - Merge when checks pass

5. **Deploy to Supabase:**
   - Run via Supabase SQL editor
   - Or use Supabase CLI: `supabase db push`

## Backup & Restore

### Backup
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
psql $DATABASE_URL < backup_20241022.sql
```

## Support

- **Schema questions:** See `erd_diagram.md`
- **Query examples:** See `sample_queries.sql`
- **Performance:** See `performance_baseline.md`
- **RLS testing:** See `rls_test_cases.sql`

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- ADR-004: Anonymous Authentication Model (`docs/architecture/adr-004-anonymous-auth.md`)
