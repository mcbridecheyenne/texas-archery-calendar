-- Ban list that survives account deletion, invite links that never auto-accept, and a
-- profiles directory that can't be downloaded (2026-10-07 review findings 2, 3, 6).
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. schema.sql has the same rules, so a fresh database gets them too.
-- Run it after 20261007120000_prelaunch_safety.sql (PR #37). It does not redefine
-- anything that migration adds.
--
-- Ship the app build that knows the new "already_received" friend-request status
-- (src/features/friends) at the same time. Older builds would show "Request sent".

-- ============================================================
-- 1. Banned people can't come back by deleting their account and signing up again.
--
-- How it works: when a profile is banned, we copy the person's sign-in identities
-- (Sign in with Apple: provider 'apple' + Apple's stable "sub" id) into
-- banned_identities. Email sign-ins are stored only as a SHA-256 hash of the
-- lower-cased address. That list lives outside the profile, so deleting the account
-- doesn't erase it. A trigger then refuses to create a profile for any new account
-- whose identity is on the list. Unbanning removes the person from the list.
-- Limit: a person with a different Apple ID or email can still start over.
-- ============================================================
create table if not exists public.banned_identities (
  provider text not null,
  provider_id text not null,
  banned_user_id uuid, -- the account that was banned (no foreign key: that account may be deleted)
  banned_at timestamptz not null default now(),
  primary key (provider, provider_id)
);

alter table public.banned_identities enable row level security;

-- Nobody reaches this table from the app. Triggers and the dashboard (admin) do.
revoke all on public.banned_identities from anon, authenticated;
drop policy if exists "no app access" on public.banned_identities;
create policy "no app access" on public.banned_identities
  for all to anon, authenticated using (false) with check (false);

create index if not exists banned_identities_user on public.banned_identities (banned_user_id);

-- Copies one account's identities into the list.
create or replace function public.record_banned_identity(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.banned_identities (provider, provider_id, banned_user_id)
  select i.provider, i.provider_id, uid
  from auth.identities i
  where i.user_id = uid and i.provider <> 'email' -- an email identity's id is just the user id
  union
  select 'email', encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex'), uid
  from auth.users u
  where u.id = uid and u.email is not null
  on conflict (provider, provider_id) do nothing;
end $$;

revoke all on function public.record_banned_identity(uuid) from public, anon, authenticated;

-- Is any identity of this account on the list?
create or replace function public.identity_is_banned(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from auth.identities i
    join public.banned_identities b on b.provider = i.provider and b.provider_id = i.provider_id
    where i.user_id = uid and i.provider <> 'email'
  ) or exists (
    select 1
    from auth.users u
    join public.banned_identities b
      on b.provider = 'email'
     and b.provider_id = encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex')
    where u.id = uid and u.email is not null
  );
$$;

revoke all on function public.identity_is_banned(uuid) from public, anon, authenticated;

-- Ban in the Table Editor -> remember the identities. Unban -> forget them.
create or replace function public.sync_banned_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_banned and not old.is_banned then
    perform public.record_banned_identity(new.id);
  elsif old.is_banned and not new.is_banned then
    delete from public.banned_identities where banned_user_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists sync_banned_identity on public.profiles;
create trigger sync_banned_identity after update of is_banned on public.profiles
  for each row when (old.is_banned is distinct from new.is_banned)
  execute function public.sync_banned_identity();

revoke all on function public.sync_banned_identity() from public, anon, authenticated;

-- A new profile for a banned identity is refused.
create or replace function public.refuse_banned_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.identity_is_banned(new.id) then
    raise exception 'This account can''t be set up.';
  end if;
  return new;
end $$;

drop trigger if exists refuse_banned_identity on public.profiles;
create trigger refuse_banned_identity before insert on public.profiles
  for each row execute function public.refuse_banned_identity();

revoke all on function public.refuse_banned_identity() from public, anon, authenticated;

-- Deleting an account that is banned records the identities first (belt and braces:
-- the ban trigger above has normally done it already).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_banned) then
    perform public.record_banned_identity(auth.uid());
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- People who are already banned today.
select public.record_banned_identity(id) from public.profiles where is_banned;

-- ============================================================
-- 4. Invite links must not auto-accept.
-- If the other person already asked you, you get "already_received" and accept it
-- yourself from Friends. send_friend_request_to() calls this, so it gets the same rule.
-- Returns {"status": "sent" | "already_sent" | "already_received" | "already_friends", "name": "..."}.
-- ("accepted" is no longer returned; the app still understands it.)
-- ============================================================
create or replace function public.send_friend_request(code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid;
  their_name text;
  existing record;
begin
  if me is null or not public.is_active_member(me) then
    raise exception 'Sign in and finish your profile to add friends.';
  end if;

  select id, display_name into them, their_name
  from public.profiles
  where friend_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')) and not is_banned;

  if them is null then
    raise exception 'No archer has that friend code. Check it and try again.';
  end if;
  if them = me then
    raise exception 'That''s your own friend code. Share it with friends so they can add you.';
  end if;
  if public.either_blocked(me, them) then
    raise exception 'You can''t add this archer.';
  end if;

  select * into existing from public.friendships
  where (requester_id = me and addressee_id = them) or (requester_id = them and addressee_id = me);

  if found then
    if existing.status = 'accepted' then
      return json_build_object('status', 'already_friends', 'name', their_name);
    elsif existing.requester_id = me then
      return json_build_object('status', 'already_sent', 'name', their_name);
    else
      -- They asked you first. Never accept on the person's behalf (an invite link could
      -- otherwise be used to get accepted without a tap); they accept from Friends.
      return json_build_object('status', 'already_received', 'name', their_name);
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, them);
  return json_build_object('status', 'sent', 'name', their_name);
end $$;

revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

-- ============================================================
-- 5. No full directory download.
-- Before, any signed-in archer could list every name, town and class. Now a profile
-- row is readable only when there is a reason to see it (can_see_profile below).
-- search_archers() is the only way to find people you have no link to, and it
-- honors "Let other archers find me by name".
-- ============================================================
create or replace function public.can_see_profile(target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or target is null then
    return false;
  end if;

  -- yourself
  if target = me then
    return true;
  end if;

  -- friends, and people you have a pending request with (either direction)
  if exists (
    select 1 from public.friendships f
    where (f.requester_id = me and f.addressee_id = target)
       or (f.requester_id = target and f.addressee_id = me)
  ) then
    return true;
  end if;

  -- the other person in one of your conversations
  if exists (
    select 1 from public.conversations c
    where (c.buyer_id = me and c.seller_id = target)
       or (c.seller_id = me and c.buyer_id = target)
  ) then
    return true;
  end if;

  -- anyone else is visible only while in good standing
  if not public.is_active_member(target) then
    return false;
  end if;

  -- sellers whose listing is for sale right now (what the marketplace shows)
  if exists (
    select 1 from public.listings l
    where l.seller_id = target and l.status = 'active' and l.renewed_at > now() - interval '60 days'
  ) then
    return true;
  end if;

  -- creators of an active archer-added tournament (what the calendar shows)
  if exists (
    select 1 from public.community_events e
    where e.created_by = target and e.status = 'active'
  ) then
    return true;
  end if;

  -- archers who shared a shoot with "Everyone" (the attendee list on that shoot;
  -- shoots shared with friends only are covered by the friends rule above)
  if exists (
    select 1 from public.going g
    where g.user_id = target and g.visibility = 'public'
  ) and not public.either_blocked(me, target) then
    return true;
  end if;

  return false;
end $$;

revoke all on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.can_see_profile(uuid) to authenticated;

drop policy if exists "signed-in archers see profiles" on public.profiles;
create policy "signed-in archers see profiles" on public.profiles
  for select to authenticated using (public.can_see_profile(id));

-- ============================================================
-- Signed-out access to is_active_member().
-- The review wanted: revoke execute on public.is_active_member(uuid) from anon;
-- NOT applied: the rules that let signed-out visitors browse listings and archer-added
-- shoots call it, and a rule runs with the caller's rights, so signed-out browsing
-- would fail outright. Safe fix = move it into a schema the API doesn't expose (and
-- repoint those rules), as a separate change. See README-20261007.md.
-- revoke execute on function public.is_active_member(uuid) from anon;
