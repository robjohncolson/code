# Database Performance Baseline

## Overview
This document establishes performance targets and validates index effectiveness for the AP Statistics Quiz database.

## Performance Targets

| Query Type | Target Time | Notes |
|-----------|-------------|-------|
| Profile lookup | < 10ms | Single user by username (PK) |
| Progress by user | < 20ms | All units/lessons for one student |
| Peer answers (30 students) | < 50ms | All answers for one question |
| Class summary (30 students) | < 100ms | Aggregate stats for teacher dashboard |
| Badge query | < 15ms | All badges for one student |
| Activity lookup | < 20ms | Current activity for all students |

## Index Effectiveness Tests

### Test 1: Profile Lookup (Primary Key)

**Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM profiles
WHERE username = 'Apple_Penguin';
```

**Expected Plan:**
- Index Scan using profiles_pkey
- Rows: 1
- Planning Time: < 0.5ms
- Execution Time: < 5ms

**Validation:**
```sql
-- Should use primary key index
-- Planning time should be minimal
-- Execution time should be < 5ms
```

---

### Test 2: Progress by Username

**Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM progress
WHERE username = 'Apple_Penguin'
ORDER BY unit_id, lesson_id;
```

**Expected Plan:**
- Index Scan using idx_progress_username
- Rows: ~3-10 (depending on student progress)
- Execution Time: < 10ms

**Validation:**
```sql
-- Should use idx_progress_username
-- Should NOT do sequential scan
```

---

### Test 3: Peer Answers for Question

**Query:**
```sql
EXPLAIN ANALYZE
SELECT
    a.username,
    a.answer_value,
    a.reasoning,
    COUNT(v.id) as vote_count
FROM answers a
LEFT JOIN votes v ON v.target_username = a.username
    AND v.question_id = a.question_id
WHERE a.question_id = 'U1-L2-Q01'
GROUP BY a.username, a.answer_value, a.reasoning;
```

**Expected Plan:**
- Index Scan using idx_answers_question
- Hash Join or Nested Loop for votes
- Rows: ~30 (class size)
- Execution Time: < 30ms

**Validation:**
```sql
-- Primary table (answers) should use idx_answers_question
-- Join should be efficient (hash or nested loop)
```

---

### Test 4: Class Students

**Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM profiles
WHERE class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
);
```

**Expected Plan:**
- Index Scan using idx_profiles_class_section
- Subquery should use class_sections_pkey or unique index
- Rows: ~30
- Execution Time: < 15ms

**Validation:**
```sql
-- Should use idx_profiles_class_section
-- Partial index (WHERE clause) reduces scan size
```

---

### Test 5: Recent Activity

**Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM user_activity
WHERE last_activity > NOW() - INTERVAL '10 minutes'
ORDER BY last_activity DESC
LIMIT 10;
```

**Expected Plan:**
- Index Scan using idx_activity_last (DESC)
- Rows: Variable (0-30)
- Execution Time: < 10ms

**Validation:**
```sql
-- Should use idx_activity_last
-- DESC index order should prevent sort operation
```

---

### Test 6: Votes for Target User

**Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM votes
WHERE target_username = 'Apple_Penguin'
ORDER BY created_at DESC;
```

**Expected Plan:**
- Index Scan using idx_votes_target
- Rows: Variable (0-100)
- Execution Time: < 15ms

**Validation:**
```sql
-- Should use idx_votes_target
-- May need separate sort if created_at not in index
```

---

## Aggregate Query Performance

### Teacher Dashboard - Class Summary

**Query:**
```sql
EXPLAIN ANALYZE
SELECT
    p.username,
    p.total_questions_answered,
    COUNT(DISTINCT pr.unit_id) as units_started,
    AVG(pr.completion_percentage) as avg_completion
FROM profiles p
LEFT JOIN progress pr ON p.username = pr.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY p.username, p.total_questions_answered
ORDER BY avg_completion DESC;
```

**Expected Plan:**
- Index Scan on profiles using idx_profiles_class_section
- Hash Join to progress
- Aggregate
- Sort
- Total Time: < 50ms for 30 students

**Optimization Notes:**
- Materialized view possible for very large classes (>100 students)
- Progress indexes (idx_progress_username) ensure efficient join

---

## Performance Degradation Scenarios

### Scenario 1: Large Class (100+ students)

**Mitigation:**
- Class summary view pre-computes aggregates
- Incremental refresh on progress updates
- Partition progress table by unit_id if needed

**Monitor:**
- Teacher dashboard query time
- If > 200ms, consider materialized view

### Scenario 2: Many Votes (1000+ per question)

**Mitigation:**
- Composite index on (question_id, target_username, vote_type)
- Unique constraint already serves as index

**Monitor:**
- Vote aggregation query time
- If > 100ms, add covering index

### Scenario 3: Historical Data Growth

**Mitigation:**
- Partition answers table by timestamp (yearly/quarterly)
- Archive old semesters to separate table
- Partial indexes with WHERE clauses

**Threshold:**
- If answers > 1M rows, consider partitioning
- If queries > 500ms, investigate partition strategy

---

## Benchmark Script

Run this to establish baseline performance:

```sql
-- Warm up cache
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM answers;
SELECT COUNT(*) FROM progress;

-- Benchmark: Profile lookup
\timing on
SELECT * FROM profiles WHERE username = 'Apple_Penguin';
\timing off

-- Benchmark: Progress query
\timing on
SELECT * FROM progress WHERE username = 'Apple_Penguin';
\timing off

-- Benchmark: Peer answers
\timing on
SELECT * FROM answers WHERE question_id = 'U1-L2-Q01';
\timing off

-- Benchmark: Class summary
\timing on
SELECT
    p.username,
    COUNT(DISTINCT pr.unit_id) as units
FROM profiles p
LEFT JOIN progress pr ON p.username = pr.username
WHERE p.class_section_id = (
    SELECT id FROM class_sections WHERE section_code = 'STATS2024'
)
GROUP BY p.username;
\timing off
```

---

## Index Coverage Analysis

Check which queries use indexes:

```sql
-- Find unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

**Action:**
- If idx_scan = 0 for an index, consider dropping it
- If idx_scan > 1000 and slow, check index definition

---

## Query Plan Expectations

### Good Query Plan Indicators
✅ **Index Scan** - Using an index (good)
✅ **Index Only Scan** - Covered by index (excellent)
✅ **Bitmap Heap Scan** - Using index for filtering (acceptable)
✅ **Hash Join** - Efficient join for moderate data (good)
✅ **Nested Loop** - Good for small result sets

### Poor Query Plan Indicators
❌ **Seq Scan** on large tables - Full table scan (bad)
❌ **Sort** on large datasets without index - Memory intensive
❌ **Hash Aggregate** without index - May spill to disk

---

## Monitoring Queries

### Slow Queries

```sql
-- Find slow queries (if pg_stat_statements enabled)
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%FROM profiles%'
   OR query LIKE '%FROM answers%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Table Statistics

```sql
-- Check table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Index Usage

```sql
-- Check index hit ratio
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## Acceptance Criteria

For production readiness, all these must pass:

- [ ] ✅ All indexes exist (run validate_schema.sql)
- [ ] ✅ Profile lookup < 10ms
- [ ] ✅ Progress query < 20ms
- [ ] ✅ Peer answers query < 50ms
- [ ] ✅ Class summary < 100ms
- [ ] ✅ No sequential scans on large tables
- [ ] ✅ EXPLAIN ANALYZE shows index usage
- [ ] ✅ No query > 500ms in production

---

## References
- PostgreSQL EXPLAIN: https://www.postgresql.org/docs/current/sql-explain.html
- Index Tuning: https://www.postgresql.org/docs/current/indexes-types.html
- Query Performance: https://www.postgresql.org/docs/current/performance-tips.html
