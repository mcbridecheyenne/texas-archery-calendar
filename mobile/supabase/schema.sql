-- Archery in the USA: marketplace database.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: it only creates things that don't exist yet and replaces policies.

-- ============================================================
-- Profiles: one per signed-in person. Public name + city only.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  city text check (city is null or char_length(city) <= 60),
  accepted_rules_at timestamptz not null default now(),
  is_banned boolean not null default false, -- set true in the Table Editor to ban someone
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles
  for select using (true);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert with check (id = auth.uid() and is_banned = false);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Friend code: a short code each archer shares so friends can add them.
-- Letters and digits that are easy to read aloud (no 0/O or 1/I/L).
create or replace function public.new_friend_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end $$;

alter table public.profiles add column if not exists friend_code text unique;

alter table public.profiles alter column friend_code set default public.new_friend_code();
update public.profiles set friend_code = public.new_friend_code() where friend_code is null;

-- People can't unban themselves: is_banned can only change from the dashboard.
-- The friend code can't be changed from the app either.
create or replace function public.protect_ban_flag()
returns trigger language plpgsql as $$
begin
  -- App requests run as 'authenticated'; your dashboard edits run as an admin role.
  if current_user in ('authenticated', 'anon') then
    new.is_banned := old.is_banned;
    new.friend_code := old.friend_code;
  end if;
  return new;
end $$;

drop trigger if exists protect_ban_flag on public.profiles;
create trigger protect_ban_flag before update on public.profiles
  for each row execute function public.protect_ban_flag();

create or replace function public.is_active_member(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and not is_banned);
$$;

-- ============================================================
-- Listings
-- ============================================================
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  price_cents integer not null check (price_cents between 0 and 2000000),
  category text not null check (category in (
    'bows', 'arrows', 'sights', 'rests', 'releases', 'stabilizers',
    'cases', 'targets', 'points', 'apparel', 'other')),
  condition text not null check (condition in ('new', 'like_new', 'good', 'fair', 'parts')),
  city text check (city is null or char_length(city) <= 60),
  -- Optional "hand off at a shoot": a tournament from the calendar.
  handoff_event_id text,
  handoff_event_name text check (handoff_event_name is null or char_length(handoff_event_name) <= 120),
  handoff_event_date date,
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listings expire so the market doesn't fill up with old gear. A listing is hidden
-- from browsing 60 days after it was posted or last renewed ("Still for sale? Renew").
-- renewed_at is that clock. When this line first runs on a database that already has
-- listings, they all get today's date, so they get a fresh 60 days instead of vanishing.
-- (Re-running it does nothing once the column exists.)
alter table public.listings add column if not exists renewed_at timestamptz not null default now();

create index if not exists listings_feed on public.listings (status, created_at desc);
create index if not exists listings_seller on public.listings (seller_id);
create index if not exists listings_fresh on public.listings (renewed_at) where status = 'active';

alter table public.listings enable row level security;

-- Everyone (even signed out) can browse active listings from members in good standing,
-- as long as the listing was posted or renewed in the last 60 days.
-- Sellers also see their own sold, removed and expired listings.
drop policy if exists "browse listings" on public.listings;
create policy "browse listings" on public.listings
  for select using (
    (status = 'active' and renewed_at > now() - interval '60 days' and public.is_active_member(seller_id))
    or seller_id = auth.uid()
  );

drop policy if exists "post listings" on public.listings;
create policy "post listings" on public.listings
  for insert with check (
    seller_id = auth.uid() and status = 'active' and public.is_active_member(auth.uid())
  );

-- Sellers can edit and mark sold, but can't undo a removal by you.
drop policy if exists "edit own listings" on public.listings;
create policy "edit own listings" on public.listings
  for update using (seller_id = auth.uid() and status <> 'removed')
  with check (seller_id = auth.uid() and status in ('active', 'sold'));

drop policy if exists "delete own listings" on public.listings;
create policy "delete own listings" on public.listings
  for delete using (seller_id = auth.uid());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

-- The 60-day clock can't be faked from the app. A new listing always starts today.
-- Renewing (changing renewed_at) always sets it to right now, and only works on a
-- listing that's still for sale. Who can renew is the "edit own listings" rule above:
-- only the seller. Your dashboard edits aren't limited by this.
create or replace function public.protect_listing_renewal()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.renewed_at := now();
    elsif new.renewed_at is distinct from old.renewed_at then
      if old.status <> 'active' or new.status <> 'active' then
        raise exception 'Only listings that are still for sale can be renewed';
      end if;
      new.renewed_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_listing_renewal on public.listings;
create trigger protect_listing_renewal before insert or update on public.listings
  for each row execute function public.protect_listing_renewal();

-- ============================================================
-- Blocks: hide someone's listings and stop their messages.
-- ============================================================
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "see own blocks" on public.blocks;
create policy "see own blocks" on public.blocks
  for select using (blocker_id = auth.uid());

drop policy if exists "block people" on public.blocks;
create policy "block people" on public.blocks
  for insert with check (blocker_id = auth.uid());

drop policy if exists "unblock people" on public.blocks;
create policy "unblock people" on public.blocks
  for delete using (blocker_id = auth.uid());

create or replace function public.either_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ============================================================
-- Conversations (one per buyer per listing) and messages
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text not null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  buyer_read_at timestamptz,
  seller_read_at timestamptz,
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index if not exists conversations_buyer on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller on public.conversations (seller_id, last_message_at desc);

alter table public.conversations enable row level security;

drop policy if exists "see own conversations" on public.conversations;
create policy "see own conversations" on public.conversations
  for select using (auth.uid() in (buyer_id, seller_id));

-- A buyer can start a conversation about someone else's active, not-expired listing.
drop policy if exists "start conversations" on public.conversations;
create policy "start conversations" on public.conversations
  for insert with check (
    buyer_id = auth.uid()
    and public.is_active_member(auth.uid())
    and not public.either_blocked(buyer_id, seller_id)
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = conversations.seller_id and l.status = 'active'
        and l.renewed_at > now() - interval '60 days'
    )
  );

-- Participants can only mark the conversation read (see trigger below).
drop policy if exists "mark conversations read" on public.conversations;
create policy "mark conversations read" on public.conversations
  for update using (auth.uid() in (buyer_id, seller_id))
  with check (auth.uid() in (buyer_id, seller_id));

create or replace function public.limit_conversation_updates()
returns trigger language plpgsql as $$
begin
  -- From the app, only the caller's own read time can change. The message trigger
  -- (on_new_message) runs as the table owner, so it can update the summary fields.
  if current_user in ('authenticated', 'anon') then
    new.listing_id := old.listing_id;
    new.listing_title := old.listing_title;
    new.buyer_id := old.buyer_id;
    new.seller_id := old.seller_id;
    new.last_message_at := old.last_message_at;
    new.last_message_preview := old.last_message_preview;
    new.last_sender_id := old.last_sender_id;
    if auth.uid() = old.buyer_id then new.seller_read_at := old.seller_read_at; end if;
    if auth.uid() = old.seller_id then new.buyer_read_at := old.buyer_read_at; end if;
  end if;
  return new;
end $$;

drop trigger if exists limit_conversation_updates on public.conversations;
create trigger limit_conversation_updates before update on public.conversations
  for each row execute function public.limit_conversation_updates();

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_by_conversation on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "read own messages" on public.messages;
create policy "read own messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );

drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_active_member(auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() in (c.buyer_id, c.seller_id)
        and not public.either_blocked(c.buyer_id, c.seller_id)
    )
  );

-- Keep the inbox summary current, and count the sender's own message as read.
create or replace function public.on_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 140),
    last_sender_id = new.sender_id,
    buyer_read_at = case when new.sender_id = c.buyer_id then new.created_at else c.buyer_read_at end,
    seller_read_at = case when new.sender_id = c.seller_id then new.created_at else c.seller_read_at end
  where c.id = new.conversation_id;
  return new;
end $$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message after insert on public.messages
  for each row execute function public.on_new_message();

-- ============================================================
-- Reports: anyone signed in can report; only you read them (Table Editor).
-- ============================================================
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  message_id bigint references public.messages (id) on delete set null,
  reason text not null check (reason in ('scam', 'prohibited', 'offensive', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "file reports" on public.reports;
create policy "file reports" on public.reports
  for insert with check (reporter_id = auth.uid());

-- ============================================================
-- Friends: one row per pair. Requests start 'pending' and the other
-- archer accepts. Requests are only created through send_friend_request().
-- ============================================================
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Only one row per pair, whichever way round it was sent.
create unique index if not exists friendships_one_per_pair on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee on public.friendships (addressee_id);

alter table public.friendships enable row level security;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));

-- The person a request was sent to can accept it.
drop policy if exists "accept friend requests" on public.friendships;
create policy "accept friend requests" on public.friendships
  for update using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

-- Either person can decline, cancel or unfriend.
drop policy if exists "remove friendships" on public.friendships;
create policy "remove friendships" on public.friendships
  for delete using (auth.uid() in (requester_id, addressee_id));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

-- Add a friend by their friend code. If they already asked you, this accepts.
-- Returns {"status": "sent" | "accepted" | "already_sent" | "already_friends", "name": "..."}.
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
      update public.friendships set status = 'accepted', accepted_at = now()
      where requester_id = them and addressee_id = me;
      return json_build_object('status', 'accepted', 'name', their_name);
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, them);
  return json_build_object('status', 'sent', 'name', their_name);
end $$;

revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.stamp_accepted_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end $$;

drop trigger if exists stamp_accepted_at on public.friendships;
create trigger stamp_accepted_at before update on public.friendships
  for each row execute function public.stamp_accepted_at();

-- Blocking someone also ends the friendship.
create or replace function public.unfriend_on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists unfriend_on_block on public.blocks;
create trigger unfriend_on_block after insert on public.blocks
  for each row execute function public.unfriend_on_block();

-- ============================================================
-- Going: tournaments an archer chose to share. "Just me" stays on the
-- phone and never comes here. 'friends' rows are seen only by accepted
-- friends; 'public' rows by any signed-in archer. Signed-out visitors see none.
-- ============================================================
create table if not exists public.going (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null check (char_length(event_id) <= 200),
  event_name text not null check (char_length(event_name) <= 200),
  event_date date not null,
  visibility text not null check (visibility in ('friends', 'public')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists going_by_event on public.going (event_id);
create index if not exists going_by_date on public.going (event_date);

alter table public.going enable row level security;

drop policy if exists "see shared going" on public.going;
create policy "see shared going" on public.going
  for select to authenticated using (
    user_id = auth.uid()
    or (
      public.is_active_member(user_id)
      and not public.either_blocked(auth.uid(), user_id)
      and (visibility = 'public' or public.are_friends(auth.uid(), user_id))
    )
  );

drop policy if exists "share own going" on public.going;
create policy "share own going" on public.going
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_member(auth.uid()));

drop policy if exists "change own going" on public.going;
create policy "change own going" on public.going
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "remove own going" on public.going;
create policy "remove own going" on public.going
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- Tournaments added by archers. Shown in the calendar under
-- "Added by archers", always labeled as not from an official schedule.
-- ============================================================
create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 120),
  start_date date not null,
  end_date date not null,
  location text not null check (char_length(trim(location)) between 2 and 160),
  city text not null check (char_length(trim(city)) between 2 and 60),
  host text check (host is null or char_length(host) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 120),
  url text check (url is null or (char_length(url) <= 300 and url ~* '^https?://')),
  details text check (details is null or char_length(details) <= 1500),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 14)
);

create index if not exists community_events_dates on public.community_events (status, start_date);
create index if not exists community_events_creator on public.community_events (created_by);

alter table public.community_events enable row level security;

-- Anyone can see active ones (browsing needs no account); creators also see their removed ones.
drop policy if exists "browse community events" on public.community_events;
create policy "browse community events" on public.community_events
  for select using (
    (status = 'active' and public.is_active_member(created_by))
    or created_by = auth.uid()
  );

drop policy if exists "add community events" on public.community_events;
create policy "add community events" on public.community_events
  for insert with check (
    created_by = auth.uid() and status = 'active' and public.is_active_member(auth.uid())
    and start_date >= current_date - 1
  );

-- Creators can edit their own, but can't undo a removal by you.
drop policy if exists "edit own community events" on public.community_events;
create policy "edit own community events" on public.community_events
  for update using (created_by = auth.uid() and status = 'active')
  with check (created_by = auth.uid() and status = 'active');

drop policy if exists "delete own community events" on public.community_events;
create policy "delete own community events" on public.community_events
  for delete using (created_by = auth.uid());

drop trigger if exists community_events_touch on public.community_events;
create trigger community_events_touch before update on public.community_events
  for each row execute function public.touch_updated_at();

-- Optional flyer picture, stored in the listing-photos bucket as <user id>/tournaments/<file>.jpg
alter table public.community_events add column if not exists flyer_path text
  check (flyer_path is null or char_length(flyer_path) <= 300);

-- Two-letter state. Anything other than TX shows under "Out of state" in the app.
alter table public.community_events add column if not exists state text not null default 'TX'
  check (state ~ '^[A-Z]{2}$');

-- Reports can point at an archer-added tournament too.
alter table public.reports add column if not exists community_event_id uuid
  references public.community_events (id) on delete set null;

-- ============================================================
-- Archery class shown next to your name (e.g. "Known 50", "Senior Open").
-- ============================================================
alter table public.profiles add column if not exists archery_class text
  check (archery_class is null or char_length(archery_class) <= 40);

-- ============================================================
-- Finding friends by name. Only archers who turned on "Let other archers
-- find me by name" show up, and never anyone you've blocked or who blocked you.
-- ============================================================
alter table public.profiles add column if not exists discoverable boolean not null default false;

drop function if exists public.search_archers(text);

-- q: part of a name or town (optional when a class is picked); klass: archery class (optional).
create or replace function public.search_archers(q text, klass text default null)
returns table (id uuid, display_name text, city text, archery_class text, relation text)
language sql stable security definer set search_path = public as $$
  with term as (
    select replace(replace(replace(trim(coalesce(q, '')), '\', ''), '%', ''), '_', '') as t,
           nullif(trim(coalesce(klass, '')), '') as k
  )
  select p.id, p.display_name, p.city, p.archery_class,
    coalesce((
      select case
        when f.status = 'accepted' then 'friends'
        when f.requester_id = auth.uid() then 'sent'
        else 'received' end
      from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p.id)
         or (f.requester_id = p.id and f.addressee_id = auth.uid())
      limit 1
    ), 'none') as relation
  from public.profiles p, term
  where auth.uid() is not null
    and public.is_active_member(auth.uid())
    and (char_length(term.t) >= 2 or term.k is not null)
    and p.discoverable
    and not p.is_banned
    and p.id <> auth.uid()
    and not public.either_blocked(auth.uid(), p.id)
    and (term.t = '' or p.display_name ilike '%' || term.t || '%' or p.city ilike term.t || '%')
    and (term.k is null or p.archery_class ilike term.k)
  order by (p.display_name ilike term.t || '%') desc, p.display_name
  limit 25;
$$;

revoke all on function public.search_archers(text, text) from public, anon;
grant execute on function public.search_archers(text, text) to authenticated;

-- Send a request to someone found by search (they must still be searchable).
create or replace function public.send_friend_request_to(target uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  select friend_code into c from public.profiles where id = target and discoverable and not is_banned;
  if c is null then
    raise exception 'This archer can''t be found anymore.';
  end if;
  return public.send_friend_request(c);
end $$;

revoke all on function public.send_friend_request_to(uuid) from public, anon;
grant execute on function public.send_friend_request_to(uuid) to authenticated;

-- ============================================================
-- Delete my account (Apple requires this inside the app).
-- The app removes the person's photos first, then calls this.
-- ============================================================
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- Listing photos: anyone can view; people can only manage their own folder.
-- Files are stored as <user id>/<listing id>/<n>.jpg
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "upload own photos" on storage.objects;
create policy "upload own photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "replace own photos" on storage.objects;
create policy "replace own photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "delete own photos" on storage.objects;
create policy "delete own photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "list own photos" on storage.objects;
create policy "list own photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Live updates for chat and the inbox.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- ============================================================
-- Rough location of a listing's pickup spot, for the "within N miles" filter.
-- Rounded to about 3 miles in the app so it never pins down someone's house.
-- Safe to re-run; add these before shipping the app version that reads them.
-- ============================================================
alter table public.listings add column if not exists lat double precision
  check (lat is null or lat between -90 and 90);
alter table public.listings add column if not exists lng double precision
  check (lng is null or lng between -180 and 180);
create index if not exists listings_lat on public.listings (lat) where status = 'active';

-- ============================================================
-- Archery in the USA: home state (the calendar's state filter starts on it) and
-- when the archer confirmed they're 13 or older at sign-up. The birth date itself
-- is never stored. Safe to re-run; add these before shipping the app version that
-- reads them.
-- ============================================================
alter table public.profiles add column if not exists home_state text
  check (home_state is null or home_state ~ '^[A-Z]{2}$');
alter table public.profiles add column if not exists age_confirmed_at timestamptz;
