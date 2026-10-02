-- Archery in Texas: marketplace database.
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

-- People can't unban themselves: is_banned can only change from the dashboard.
create or replace function public.protect_ban_flag()
returns trigger language plpgsql as $$
begin
  -- App requests run as 'authenticated'; your dashboard edits run as an admin role.
  if new.is_banned is distinct from old.is_banned and current_user in ('authenticated', 'anon') then
    new.is_banned := old.is_banned;
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

create index if not exists listings_feed on public.listings (status, created_at desc);
create index if not exists listings_seller on public.listings (seller_id);

alter table public.listings enable row level security;

-- Everyone (even signed out) can browse active listings from members in good standing.
-- Sellers also see their own sold/removed listings.
drop policy if exists "browse listings" on public.listings;
create policy "browse listings" on public.listings
  for select using (
    (status = 'active' and public.is_active_member(seller_id))
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

-- A buyer can start a conversation about someone else's active listing.
drop policy if exists "start conversations" on public.conversations;
create policy "start conversations" on public.conversations
  for insert with check (
    buyer_id = auth.uid()
    and public.is_active_member(auth.uid())
    and not public.either_blocked(buyer_id, seller_id)
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = conversations.seller_id and l.status = 'active'
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
