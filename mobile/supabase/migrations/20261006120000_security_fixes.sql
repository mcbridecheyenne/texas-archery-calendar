-- Security fixes from the 2026-10-06 studio review (findings 1, 2 and 35).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run. schema.sql has the same rules, so a fresh database gets them too.
--
-- Ship the app build that calls my_profile() and my_friend_code() at the same time:
-- older builds read their own profile and friend code straight from the table,
-- which this stops.

-- ============================================================
-- 1. Friend requests: accepting can only change the status.
-- Before this, the addressee could also rewrite requester_id or addressee_id,
-- and so make themselves friends with anyone.
-- ============================================================
revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

-- Belt and braces: even if the column rule is ever loosened, the app can't
-- move a friendship to other people. Dashboard edits aren't limited by this.
create or replace function public.lock_friendship_pair()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.requester_id := old.requester_id;
    new.addressee_id := old.addressee_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists lock_friendship_pair on public.friendships;
create trigger lock_friendship_pair before update on public.friendships
  for each row execute function public.lock_friendship_pair();

-- ============================================================
-- 2. Profiles: signed-out visitors can't read them, and signed-in archers
-- only see the public columns of other people (name, town, class, member since).
-- Friend code, home state, ban flag, "find me by name" and age confirmation
-- stay private. Your own full profile comes from my_profile(), your friend
-- code from my_friend_code().
-- ============================================================
drop policy if exists "profiles are public" on public.profiles;
drop policy if exists "signed-in archers see profiles" on public.profiles;
create policy "signed-in archers see profiles" on public.profiles
  for select to authenticated using (true);

revoke all on public.profiles from anon;
revoke select on public.profiles from authenticated;
grant select (id, display_name, city, archery_class, created_at) on public.profiles to authenticated;

-- New profiles get a friend code from new_friend_code(), which checks every
-- existing code. Signed-in archers can no longer read those, so it runs as the owner.
alter function public.new_friend_code() security definer;
revoke all on function public.new_friend_code() from public, anon;
grant execute on function public.new_friend_code() to authenticated;

create or replace function public.my_profile()
returns table (
  id uuid, display_name text, city text, archery_class text, discoverable boolean,
  home_state text, age_confirmed_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.city, p.archery_class, p.discoverable,
         p.home_state, p.age_confirmed_at, p.created_at
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

create or replace function public.my_friend_code()
returns text language sql stable security definer set search_path = public as $$
  select friend_code from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_friend_code() from public, anon;
grant execute on function public.my_friend_code() to authenticated;

-- ============================================================
-- 35. Privileged functions: signed-out visitors can't call them, and
-- trigger-only ones can't be called from the app at all (triggers still run them).
-- is_active_member() stays callable when signed out: the rules that let
-- signed-out visitors browse listings and archer-added shoots use it, and it
-- only answers "is this account in good standing".
-- ============================================================
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

revoke all on function public.either_blocked(uuid, uuid) from public, anon;
grant execute on function public.either_blocked(uuid, uuid) to authenticated;

revoke all on function public.on_new_message() from public, anon, authenticated;
revoke all on function public.push_on_friendship() from public, anon, authenticated;
revoke all on function public.push_on_new_message() from public, anon, authenticated;
revoke all on function public.unfriend_on_block() from public, anon, authenticated;

-- Pin the search path on the trigger functions that didn't have one.
alter function public.protect_ban_flag() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.protect_listing_renewal() set search_path = public;
alter function public.limit_conversation_updates() set search_path = public;
alter function public.stamp_accepted_at() set search_path = public;
