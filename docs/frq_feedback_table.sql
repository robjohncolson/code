-- Enable UUID generation if it is not already available
create extension if not exists "uuid-ossp";

-- Table to store AI-generated feedback for free-response questions
create table if not exists public.frq_feedback (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default timezone('utc', now()),
    username text,
    question_id text not null,
    student_response text not null,
    exemplar text,
    rubric jsonb,
    score numeric(3,1),
    summary text,
    strengths jsonb,              -- JSON array of strengths strings
    areas_for_improvement jsonb,  -- JSON array of improvement suggestions
    rubric_alignment jsonb,       -- JSON array of rubric alignment objects
    provider_response jsonb       -- Raw response returned by Gemini for auditing
);

create index if not exists frq_feedback_question_idx on public.frq_feedback(question_id);
create index if not exists frq_feedback_username_idx on public.frq_feedback(username);
