-- Featured shoots: a paid spot at the top of one state's list or the "All states" list
-- for 7, 14 or 30 days, bought with an Apple in-app purchase through RevenueCat
-- (see docs/featured-shoots.md). Run once in Supabase: Dashboard -> SQL Editor ->
-- New query -> paste -> Run. Safe to re-run. schema.sql has the same rules.
--
-- Only the feature-shoot edge function writes here (with the service role) after it has
-- checked the purchase with RevenueCat. The app and the website read active rows.

create table if not exists public.featured_shoots (
  id uuid primary key default gen_random_uuid(),
  -- Who bought it. Kept (with the name they gave) if the account is deleted later.
  buyer_id uuid references public.profiles (id) on delete set null,
  buyer_name text not null check (char_length(trim(buyer_name)) between 2 and 60),
  -- The shoot, as a snapshot: the feed id ("tfaa-…", "manual-…") or "user:<uuid>" for
  -- archer-added shoots, plus what the card shows.
  event_id text not null check (char_length(event_id) <= 120),
  event_source text not null check (char_length(event_source) <= 20),
  event_name text not null check (char_length(event_name) <= 160),
  event_start date not null,
  event_end date not null,
  event_city text check (event_city is null or char_length(event_city) <= 80),
  event_state text check (event_state is null or char_length(event_state) <= 2),
  event_location text check (event_location is null or char_length(event_location) <= 200),
  event_url text check (event_url is null or char_length(event_url) <= 400),
  event_flyer_path text check (event_flyer_path is null or char_length(event_flyer_path) <= 200),
  -- Where it shows: the top of one state's list, or the top of "All states".
  placement text not null check (placement in ('state', 'national')),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  spot text generated always as (case when placement = 'national' then 'ALL' else state end) stored,
  days int not null check (days in (7, 14, 30)),
  -- The purchase (one feature per store transaction).
  product_id text not null,
  store text,
  store_transaction_id text not null unique,
  rc_app_user_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'ended', 'removed')),
  ended_reason text check (ended_reason is null or char_length(ended_reason) <= 200),
  -- Set when the shoot was last missing from the organizer feed; cleared when it is back.
  missing_since timestamptz,
  shown_count int not null default 0,
  opened_count int not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (placement = 'national' or state is not null)
);

create index if not exists featured_shoots_live on public.featured_shoots (spot, ends_at) where status = 'active';
create index if not exists featured_shoots_buyer on public.featured_shoots (buyer_id);
create index if not exists featured_shoots_event on public.featured_shoots (event_id) where status = 'active';

alter table public.featured_shoots enable row level security;

-- Everyone can see live and queued features (the app and website show them); buyers also
-- see their own ended ones. Nobody writes from the app: the edge function does, as service role.
revoke all on public.featured_shoots from anon, authenticated;
grant select on public.featured_shoots to anon, authenticated;
drop policy if exists "see live features" on public.featured_shoots;
create policy "see live features" on public.featured_shoots
  for select to anon, authenticated
  using ((status = 'active' and ends_at > now()) or (auth.uid() is not null and buyer_id = auth.uid()));

-- "Shown 1,240 times · 63 people opened it" for the buyer. Anyone can count, nobody can read
-- or change anything else through this.
create or replace function public.count_featured(ids uuid[], kind text)
returns void language sql security definer set search_path = public as $$
  update public.featured_shoots
  set shown_count = shown_count + (case when kind = 'shown' then 1 else 0 end),
      opened_count = opened_count + (case when kind = 'opened' then 1 else 0 end)
  where id = any(ids) and status = 'active' and kind in ('shown', 'opened') and cardinality(ids) <= 20;
$$;
revoke all on function public.count_featured(uuid[], text) from public;
grant execute on function public.count_featured(uuid[], text) to anon, authenticated;

-- The owner hears about every new feature (same push as reports), so a bad one can be
-- removed from the Table Editor (set status to 'removed').
create or replace function public.alert_admins_on_feature()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin uuid;
begin
  for admin in select user_id from public.app_admins loop
    perform public.send_push(
      admin,
      'New featured shoot (' || new.days || ' days, ' || new.spot || ')',
      left(new.event_name || ' · promoted by ' || new.buyer_name, 150),
      jsonb_build_object('type', 'featured', 'featuredId', new.id)
    );
  end loop;
  return new;
end $$;
revoke all on function public.alert_admins_on_feature() from public, anon, authenticated;
drop trigger if exists alert_admins_on_feature on public.featured_shoots;
create trigger alert_admins_on_feature after insert on public.featured_shoots
  for each row execute function public.alert_admins_on_feature();

-- An archer-added shoot that is deleted, or removed by a moderator, takes its feature with it.
create or replace function public.end_features_of_removed_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' or new.status <> 'active' then
    update public.featured_shoots
    set status = 'ended', ended_reason = case when tg_op = 'DELETE' then 'shoot deleted' else 'shoot removed' end
    where event_id = 'user:' || coalesce(old.id, new.id)::text and status = 'active';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.end_features_of_removed_event() from public, anon, authenticated;
drop trigger if exists end_features_of_removed_event on public.community_events;
create trigger end_features_of_removed_event after update of status or delete on public.community_events
  for each row execute function public.end_features_of_removed_event();
