-- Featured shoots: anyone signed in can pay (Apple in-app purchase) to show an upcoming
-- shoot at the top of one state's list or the "All states" list for 7, 14 or 30 days.
-- Up to 3 run at once per spot; a new one waits for the next open place. A feature ends
-- early when the shoot is over.
-- Rows are only created by the claim-feature edge function after it checks the purchase
-- with RevenueCat (it uses the service role); the app can't create, change or delete them.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.

create table if not exists public.featured_shoots (
  id uuid primary key default gen_random_uuid(),
  spot text not null check (spot = 'ALL' or spot ~ '^[A-Z]{2}$'), -- a state, or ALL for the nationwide list
  event_id text not null check (char_length(event_id) <= 200),
  event_name text not null check (char_length(event_name) <= 200),
  event_start date not null,
  event_end date not null,
  event_source text not null check (char_length(event_source) <= 20),
  event_city text check (event_city is null or char_length(event_city) <= 80),
  promoter_id uuid references public.profiles (id) on delete set null,
  promoter_name text not null check (char_length(promoter_name) <= 60),
  product_id text not null check (char_length(product_id) <= 80),
  purchase_id text not null unique check (char_length(purchase_id) <= 200), -- the store transaction; each can be used once
  days int not null check (days in (7, 14, 30)),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'active' check (status in ('active', 'removed')),
  views int not null default 0,
  opens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists featured_shoots_spot on public.featured_shoots (spot, ends_at) where status = 'active';
create index if not exists featured_shoots_promoter on public.featured_shoots (promoter_id);

alter table public.featured_shoots enable row level security;

-- Everyone (signed out too) sees features that are running now. People also see their own
-- (including ones waiting for a place or already finished) with their view counts.
drop policy if exists "see featured shoots" on public.featured_shoots;
create policy "see featured shoots" on public.featured_shoots
  for select using (
    (status = 'active' and starts_at <= now() and ends_at > now())
    or promoter_id = auth.uid()
  );

revoke all on public.featured_shoots from anon, authenticated;
grant select on public.featured_shoots to anon, authenticated;

-- The earliest time from now when fewer than 3 features in the spot overlap.
create or replace function public.featured_next_start(want_spot text)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(t) from (
    select now() as t
    union all
    select f.ends_at from public.featured_shoots f
    where f.spot = want_spot and f.status = 'active' and f.ends_at > now()
  ) candidates
  where (
    select count(*) from public.featured_shoots g
    where g.spot = want_spot and g.status = 'active' and g.starts_at <= candidates.t and g.ends_at > candidates.t
  ) < 3;
$$;

-- Is there room in a spot, and if not, when does the next place open?
-- Returns how many are running now and when a new feature would start.
create or replace function public.featured_availability(want_spot text)
returns table (running int, next_start timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.featured_shoots f
      where f.spot = want_spot and f.status = 'active' and f.starts_at <= now() and f.ends_at > now()),
    public.featured_next_start(want_spot);
$$;

revoke all on function public.featured_availability(text) from public;
grant execute on function public.featured_availability(text) to anon, authenticated;
revoke all on function public.featured_next_start(text) from public, anon, authenticated;
grant execute on function public.featured_next_start(text) to service_role; -- the claim-feature function

-- View and open counts the poster sees. Anyone can bump them; they only ever go up by 1.
create or replace function public.featured_seen(ids uuid[])
returns void language sql volatile security definer set search_path = public as $$
  update public.featured_shoots set views = views + 1
  where id = any(ids[1:10]) and status = 'active' and starts_at <= now() and ends_at > now();
$$;

create or replace function public.featured_opened(feature uuid)
returns void language sql volatile security definer set search_path = public as $$
  update public.featured_shoots set opens = opens + 1
  where id = feature and status = 'active' and starts_at <= now() and ends_at > now();
$$;

revoke all on function public.featured_seen(uuid[]) from public;
revoke all on function public.featured_opened(uuid) from public;
grant execute on function public.featured_seen(uuid[]) to anon, authenticated;
grant execute on function public.featured_opened(uuid) to anon, authenticated;

-- Tell the app's admins (the owner) about each new feature, so a bad one can be removed
-- quickly (Table Editor → featured_shoots → set status to removed).
create or replace function public.alert_admins_on_feature()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin uuid;
  place text := case when new.spot = 'ALL' then 'all states' else new.spot end;
begin
  for admin in select user_id from public.app_admins loop
    perform public.send_push(
      admin,
      'New featured shoot (' || place || ')',
      left(new.event_name || ' · ' || new.days || ' days · by ' || new.promoter_name, 150),
      jsonb_build_object('type', 'feature', 'featureId', new.id)
    );
  end loop;
  return new;
end $$;

revoke all on function public.alert_admins_on_feature() from public, anon, authenticated;

drop trigger if exists alert_admins_on_feature on public.featured_shoots;
create trigger alert_admins_on_feature after insert on public.featured_shoots
  for each row execute function public.alert_admins_on_feature();
