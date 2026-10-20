-- "Maybe" next to "I'm going" on a shoot. 'maybe' when the archer tapped Maybe; every row
-- saved before this is 'going', so nothing changes for them.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
alter table public.going add column if not exists status text not null default 'going'
  check (status in ('going', 'maybe'));
