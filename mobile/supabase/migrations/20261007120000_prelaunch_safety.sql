-- Safety fixes before the public release: report alerts, abuse limits and privacy.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run. schema.sql has the same rules, so a fresh database gets them too.
-- The last line shows how many accounts get report alerts; it should be 1 or more.

-- ============================================================
-- Report alerts: every new report sends a push notification to the
-- app's admins (the owner), so reports are seen within 24 hours.
-- Each report also keeps a copy of what was reported, so the evidence
-- survives if that person deletes their account.
-- ============================================================
create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);
alter table public.app_admins enable row level security; -- no rules: only the dashboard sees it
revoke all on public.app_admins from anon, authenticated;

-- The owner's account (signed in with Apple using this email). Add others in the Table Editor.
insert into public.app_admins (user_id)
select p.id from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) = 'mcbridecheyenne81@icloud.com'
on conflict do nothing;

alter table public.reports add column if not exists reported_snapshot text
  check (reported_snapshot is null or char_length(reported_snapshot) <= 4000);
alter table public.reports add column if not exists reported_user_snapshot uuid;

create or replace function public.snapshot_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bits text[] := '{}';
  r record;
begin
  if new.listing_id is not null then
    select title, description, seller_id into r from public.listings where id = new.listing_id;
    if found then
      bits := bits || ('Listing: ' || r.title || E'\n' || left(r.description, 1000));
      new.reported_user_id := coalesce(new.reported_user_id, r.seller_id);
    end if;
  end if;
  if new.message_id is not null then
    select body, sender_id into r from public.messages where id = new.message_id;
    if found then
      bits := bits || ('Message: ' || r.body);
      new.reported_user_id := coalesce(new.reported_user_id, r.sender_id);
    end if;
  end if;
  if new.community_event_id is not null then
    select name, location, details, created_by into r from public.community_events where id = new.community_event_id;
    if found then
      bits := bits || ('Tournament: ' || r.name || ' · ' || r.location || E'\n' || left(coalesce(r.details, ''), 1000));
      new.reported_user_id := coalesce(new.reported_user_id, r.created_by);
    end if;
  end if;
  if new.reported_user_id is not null then
    select display_name into r from public.profiles where id = new.reported_user_id;
    if found then bits := bits || ('Person: ' || r.display_name); end if;
  end if;
  new.reported_user_snapshot := new.reported_user_id;
  new.reported_snapshot := left(array_to_string(bits, E'\n\n'), 4000);
  new.status := 'open';
  new.created_at := now();
  return new;
end $$;

revoke all on function public.snapshot_report() from public, anon, authenticated;

drop trigger if exists snapshot_report on public.reports;
create trigger snapshot_report before insert on public.reports
  for each row execute function public.snapshot_report();

create or replace function public.alert_admins_on_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin uuid;
begin
  for admin in select user_id from public.app_admins loop
    perform public.send_push(
      admin,
      'New report: ' || new.reason,
      left(coalesce(new.reported_snapshot, new.details, 'Open the Supabase Table Editor → reports.'), 150),
      jsonb_build_object('type', 'report', 'reportId', new.id)
    );
  end loop;
  return new;
end $$;

revoke all on function public.alert_admins_on_report() from public, anon, authenticated;

drop trigger if exists alert_admins_on_report on public.reports;
create trigger alert_admins_on_report after insert on public.reports
  for each row execute function public.alert_admins_on_report();

-- Banned accounts can't file reports or accept friend requests.
drop policy if exists "file reports" on public.reports;
create policy "file reports" on public.reports
  for insert with check (reporter_id = auth.uid() and public.is_active_member(auth.uid()));

drop policy if exists "accept friend requests" on public.friendships;
create policy "accept friend requests" on public.friendships
  for update using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted' and public.is_active_member(auth.uid()));

-- ============================================================
-- Starting a conversation can't fake its inbox summary: the title comes
-- from the listing and the "last message" fields start empty.
-- ============================================================
create or replace function public.clean_new_conversation()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.listing_title := coalesce((select title from public.listings where id = new.listing_id), new.listing_title);
    new.last_message_at := null;
    new.last_message_preview := null;
    new.last_sender_id := null;
    new.buyer_read_at := null;
    new.seller_read_at := null;
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists clean_new_conversation on public.conversations;
create trigger clean_new_conversation before insert on public.conversations
  for each row execute function public.clean_new_conversation();

-- ============================================================
-- Dates can't be faked from the app: created_at is always "now" for new
-- rows and never changes after (so a listing can't pin itself to the top).
-- Dashboard edits aren't limited by this.
-- ============================================================
create or replace function public.stamp_created_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_at := now();
    else
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists stamp_created_at on public.listings;
create trigger stamp_created_at before insert or update on public.listings
  for each row execute function public.stamp_created_at();
drop trigger if exists stamp_created_at on public.messages;
create trigger stamp_created_at before insert or update on public.messages
  for each row execute function public.stamp_created_at();
drop trigger if exists stamp_created_at on public.community_events;
create trigger stamp_created_at before insert or update on public.community_events
  for each row execute function public.stamp_created_at();
drop trigger if exists stamp_created_at on public.going;
create trigger stamp_created_at before insert or update on public.going
  for each row execute function public.stamp_created_at();

-- New profiles: the friend code, ban flag, join date and rules date are set
-- by the database, not the app. (Updates are already covered by protect_ban_flag.)
create or replace function public.protect_new_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.friend_code := public.new_friend_code();
    new.is_banned := false;
    new.created_at := now();
    new.accepted_rules_at := now();
  end if;
  return new;
end $$;

drop trigger if exists protect_new_profile on public.profiles;
create trigger protect_new_profile before insert on public.profiles
  for each row execute function public.protect_new_profile();

create or replace function public.protect_ban_flag()
returns trigger language plpgsql set search_path = public as $$
begin
  -- App requests run as 'authenticated'; your dashboard edits run as an admin role.
  if current_user in ('authenticated', 'anon') then
    new.is_banned := old.is_banned;
    new.friend_code := old.friend_code;
    new.created_at := old.created_at;
    new.accepted_rules_at := old.accepted_rules_at;
  end if;
  return new;
end $$;

-- ============================================================
-- Friend and block checks only answer about the person asking, so nobody
-- can map out who is friends with (or has blocked) whom.
-- ============================================================
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b)) and exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function public.either_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b)) and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ============================================================
-- Friend request limits, so requests (and their notifications) can't be
-- used to spam someone: at most 20 requests an hour, and one request to
-- the same archer a day (even if it was cancelled in between).
-- ============================================================
create table if not exists public.friend_request_log (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists friend_request_log_recent on public.friend_request_log (requester_id, created_at desc);
alter table public.friend_request_log enable row level security; -- no rules: the app can't read or write it
revoke all on public.friend_request_log from anon, authenticated;

create or replace function public.limit_friend_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if (select count(*) from public.friend_request_log
        where requester_id = new.requester_id and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'You''ve sent a lot of friend requests. Try again in an hour.';
    end if;
    if exists (select 1 from public.friend_request_log
               where requester_id = new.requester_id and addressee_id = new.addressee_id
                 and created_at > now() - interval '1 day') then
      raise exception 'You already sent this archer a request today. Try again tomorrow.';
    end if;
    insert into public.friend_request_log (requester_id, addressee_id) values (new.requester_id, new.addressee_id);
    delete from public.friend_request_log where created_at < now() - interval '2 days';
  end if;
  return new;
end $$;

revoke all on function public.limit_friend_requests() from public, anon, authenticated;

drop trigger if exists limit_friend_requests on public.friendships;
create trigger limit_friend_requests before insert on public.friendships
  for each row execute function public.limit_friend_requests();

-- How many accounts get report alerts (should be 1 or more).
select count(*) as report_alert_recipients from public.app_admins;
