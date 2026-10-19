-- Which days of a multi-day shoot an archer is going (picked when they tap "I'm going").
-- Null means every day, so rows saved before this keep meaning what they meant.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
alter table public.going add column if not exists days date[]
  check (days is null or cardinality(days) between 1 and 31);
