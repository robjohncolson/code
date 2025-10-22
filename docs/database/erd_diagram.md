# Entity Relationship Diagram (ERD)

## AP Statistics Consensus Quiz Database Schema

### Diagram (Text Format)

```
┌─────────────────────────┐
│   class_sections        │
│─────────────────────────│
│ • id (PK)              │
│   section_code (UNIQUE) │
│   teacher_username      │
│   section_name          │
│   created_at            │
│   updated_at            │
│   settings (JSONB)      │
└─────────────────────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────────┐
│   profiles              │◄────────────────────┐
│─────────────────────────│                     │
│ • username (PK)         │                     │
│   created_at            │                     │
│   updated_at            │                     │
│   last_seen             │                     │
│   total_questions_answ  │                     │
│   total_votes_received  │                     │
│   current_unit          │                     │
│   current_question      │                     │
│   is_teacher            │                     │
│   class_section_id (FK) │                     │
│   metadata (JSONB)      │                     │
└─────────────────────────┘                     │
           │                                    │
           │ 1:N                                │
           ├────────────────────┬──────────────┼────────────┐
           │                    │              │            │
           ▼                    ▼              │            ▼
┌──────────────────┐  ┌──────────────────┐    │  ┌──────────────────┐
│   progress       │  │   answers        │    │  │   user_activity  │
│──────────────────│  │──────────────────│    │  │──────────────────│
│ • id (PK)       │  │ • (username,     │    │  │ • username (PK) │
│   username (FK) │  │    question_id,   │    │  │   activity_state │
│   unit_id       │  │    attempt_num)   │    │  │   current_quest  │
│   lesson_id     │  │                   │    │  │   last_activity  │
│   questions_comp│  │   username (FK)   │    │  │   session_id     │
│   questions_tot │  │   question_id     │    │  │   ip_hash        │
│   completion_%  │  │   attempt_number  │    │  │   user_agent_hash│
│   started_at    │  │   answer_value    │    │  └──────────────────┘
│   completed_at  │  │   answer_type     │    │
│   time_spent_sec│  │   timestamp       │    │
│   last_activity │  │   time_spent_sec  │    │
│                 │  │   confidence_level│    │
│  UNIQUE:        │  │   reasoning       │    │
│  (user,unit,les)│  │   is_correct      │    │
└──────────────────┘  │   chart_data(JSON)│    │
                      │   created_at      │    │
                      │   updated_at      │    │
                      └──────────────────┘    │
                                               │
                   ┌───────────────────────────┤
                   │                           │
                   ▼                           ▼
         ┌──────────────────┐        ┌──────────────────┐
         │   votes          │        │   badges         │
         │──────────────────│        │──────────────────│
         │ • id (PK)       │        │ • id (PK)       │
         │   question_id   │        │   username (FK) │
         │   voter_user(FK)│        │   badge_type    │
         │   target_user(FK│        │   badge_name    │
         │   vote_type     │        │   badge_descrip │
         │   created_at    │        │   earned_at     │
         │                 │        │   metadata(JSON)│
         │  UNIQUE:        │        │                 │
         │  (quest,voter,  │        │  UNIQUE:        │
         │   target,type)  │        │  (user,type)    │
         │                 │        │                 │
         │  CHECK:         │        └──────────────────┘
         │  voter≠target   │
         └──────────────────┘
```

## Relationships

### class_sections → profiles (1:N)
- **Relationship:** One class section has many students
- **FK:** profiles.class_section_id → class_sections.id
- **On Delete:** SET NULL (student can exist without class)
- **Purpose:** Group students for teacher management

### profiles → progress (1:N)
- **Relationship:** One student has progress in many units/lessons
- **FK:** progress.username → profiles.username
- **On Delete:** CASCADE (delete progress when student deleted)
- **Constraint:** UNIQUE(username, unit_id, lesson_id)

### profiles → answers (1:N)
- **Relationship:** One student has many answers (with multiple attempts)
- **FK:** answers.username → profiles.username
- **On Delete:** CASCADE (delete answers when student deleted)
- **PK:** Composite (username, question_id, attempt_number)

### profiles → votes (1:N as voter, 1:N as target)
- **Relationship:** Student can vote for others, receive votes from others
- **FK:** votes.voter_username → profiles.username
- **FK:** votes.target_username → profiles.username
- **On Delete:** CASCADE (both directions)
- **Constraint:** voter_username ≠ target_username (no self-voting)

### profiles → badges (1:N)
- **Relationship:** One student earns many badges
- **FK:** badges.username → profiles.username
- **On Delete:** CASCADE
- **Constraint:** UNIQUE(username, badge_type) - one badge per type

### profiles → user_activity (1:1)
- **Relationship:** One student has one current activity record
- **FK:** user_activity.username → profiles.username (PK)
- **On Delete:** CASCADE
- **Purpose:** Real-time presence tracking

## Cardinality Summary

| Table           | Relationship | Multiplicity | Description                      |
|-----------------|--------------|--------------|----------------------------------|
| class_sections  | → profiles   | 1:N          | Class has many students          |
| profiles        | → progress   | 1:N          | Student has many units started   |
| profiles        | → answers    | 1:N          | Student has many answers         |
| profiles        | → votes (v)  | 1:N          | Student votes many times         |
| profiles        | → votes (t)  | 1:N          | Student receives many votes      |
| profiles        | → badges     | 1:N          | Student earns many badges        |
| profiles        | → activity   | 1:1          | Student has one activity record  |

## Key Constraints

### Unique Constraints
- `class_sections.section_code` - Each class has unique code
- `profiles.username` - Primary key, anonymous username
- `progress(username, unit_id, lesson_id)` - One record per user-unit-lesson
- `answers(username, question_id, attempt_number)` - Composite PK for multi-attempt
- `votes(question_id, voter, target, vote_type)` - One vote per type combo
- `badges(username, badge_type)` - One badge of each type per student

### Check Constraints
- `profiles.username` - Must match `^[A-Za-z0-9_]+$` (3-50 chars)
- `profiles.total_questions_answered` - Must be ≥ 0
- `profiles.total_votes_received` - Must be ≥ 0
- `progress.completion_percentage` - Must be 0-100
- `progress.questions_completed` - Must be ≤ questions_total
- `answers.answer_type` - Must be valid type (multiple-choice, free-response, etc.)
- `answers.confidence_level` - Must be 1-5
- `votes.voter_username` - Must ≠ target_username (no self-voting)
- `badges.badge_type` - Must match `^[a-z_]+$`
- `user_activity.activity_state` - Must be valid state

### Foreign Key Behaviors
- **ON DELETE CASCADE:**
  - profiles → progress, answers, votes, badges, user_activity
  - (Deleting student deletes all their data)

- **ON DELETE SET NULL:**
  - class_sections → profiles.class_section_id
  - (Deleting class doesn't delete students, just unlinks them)

## Indexes for Performance

### By Table

**profiles:**
- `idx_profiles_class_section` - WHERE class_section_id IS NOT NULL
- `idx_profiles_is_teacher` - WHERE is_teacher = TRUE
- `idx_profiles_last_seen` - DESC for recent activity

**progress:**
- `idx_progress_username` - Lookup by user
- `idx_progress_unit` - Lookup by unit
- `idx_progress_user_unit` - Combined user+unit queries
- `idx_progress_completion` - Sort by completion DESC
- `idx_progress_last_activity` - Recent activity DESC

**answers:**
- `idx_answers_question` - Peer answers for a question
- `idx_answers_username` - User's answer history
- `idx_answers_timestamp` - Recent answers DESC
- `idx_answers_type` - Filter by answer type

**votes:**
- `idx_votes_question` - Votes for a question
- `idx_votes_target` - Votes received by user
- `idx_votes_voter` - Votes cast by user
- `idx_votes_created` - Recent votes DESC

**badges:**
- `idx_badges_username` - User's badges
- `idx_badges_type` - All users with badge type
- `idx_badges_earned` - Recent badges DESC

**user_activity:**
- `idx_activity_last` - Recent activity DESC
- `idx_activity_state` - Filter by state
- `idx_activity_question` - Users on same question

## Triggers & Auto-Updates

### Automatic Updates
1. **updated_at columns** - Auto-updated on row modification
   - profiles, class_sections, answers

2. **profile.total_questions_answered** - Auto-incremented on answer insert
   - Trigger: `auto_update_profile_stats`

3. **profile.total_votes_received** - Auto-incremented/decremented on vote insert/delete
   - Trigger: `auto_update_vote_count`

4. **profile.last_seen** - Auto-updated on answer insert
   - Trigger: `auto_update_profile_stats`

## JSON/JSONB Fields

### profiles.metadata
```json
{
  "preferences": {
    "dark_mode": true,
    "notifications": false
  },
  "custom_avatar": "data:image/png;base64,..."
}
```

### answers.chart_data (For chart questions)
```json
{
  "type": "histogram",
  "version": "0.1",
  "xLabel": "Score",
  "yLabel": "Frequency",
  "bins": [
    {"start": 0, "end": 10, "frequency": 5},
    {"start": 10, "end": 20, "frequency": 8}
  ],
  "sketch": "data:image/png;base64,...",
  "meta": {
    "created": 1234567890,
    "source": "chart-wizard"
  }
}
```

### badges.metadata
```json
{
  "unit": "unit1",
  "score": 95,
  "context": "First perfect score in Unit 1"
}
```

### class_sections.settings
```json
{
  "peer_visibility": true,
  "voting_enabled": true,
  "chart_wizard_enabled": true,
  "allow_retakes": true,
  "max_attempts": 3
}
```

## Views

### class_summary
Pre-computed aggregates for teacher dashboards:
- Total students per class
- Average questions answered
- Active users (today, this week)

### student_progress_summary
Per-student rollup across all units:
- Units started
- Total questions completed
- Average completion percentage
- Last activity timestamp

## Design Patterns

### Soft Deletes
**Not implemented** - Uses hard deletes with CASCADE
- Rationale: Anonymous data, COPPA compliance, no need to retain

### Audit Trailing
**Partial** - created_at and updated_at timestamps
- Full audit log not needed for educational app
- Can add later if required

### Temporal Data
**Supported** via timestamps:
- started_at, completed_at (progress)
- earned_at (badges)
- timestamp (answers)
- last_activity (user_activity)

### Multi-tenancy
**Class-based** via class_sections table:
- Students belong to classes
- Teachers see only their class data (via RLS)
- Cross-class queries restricted

## References
- Full schema: `docs/database/schema_v2.sql`
- Migration script: `migrations/001_core_tables.sql`
- RLS policies: `migrations/002_rls_policies.sql`
