-- ============================================================
-- YMIR GUILD TRACKER — Supabase Schema
-- Run this in Supabase > SQL Editor
-- ============================================================

-- USER ROLES (synced from Discord on login)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  discord_id text not null unique,
  discord_username text,
  ingame_name text,
  role text not null default 'member', -- 'admin' | 'member' | 'denied'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MEMBERS
create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rank text not null default 'Recruit',
  points integer not null default 0,
  discord_id text unique,
  created_at timestamptz default now()
);

-- EVENTS
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  date date not null,
  points_reward integer not null default 50,
  locked boolean not null default false,
  created_at timestamptz default now()
);

-- ATTENDANCE
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  created_at timestamptz default now(),
  unique(event_id, member_id)
);

-- AUCTION ITEMS
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  min_bid integer not null default 100,
  status text not null default 'active',
  end_time timestamptz,
  duration_ms bigint,
  created_at timestamptz default now()
);

-- BIDS
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  amount integer not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.user_roles enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.items enable row level security;
alter table public.bids enable row level security;

-- user_roles: users can read their own row; service role manages inserts
create policy "Users can read own role" on public.user_roles for select using (auth.uid() = user_id);
create policy "Users can upsert own role" on public.user_roles for insert with check (auth.uid() = user_id);
create policy "Users can update own role" on public.user_roles for update using (auth.uid() = user_id);

-- All authenticated users can read guild data
create policy "Auth read members" on public.members for select using (auth.role() = 'authenticated');
create policy "Auth read events" on public.events for select using (auth.role() = 'authenticated');
create policy "Auth read attendance" on public.attendance for select using (auth.role() = 'authenticated');
create policy "Auth read items" on public.items for select using (auth.role() = 'authenticated');
create policy "Auth read bids" on public.bids for select using (auth.role() = 'authenticated');

-- Only admins can write (enforced in app layer; DB layer allows authenticated for simplicity)
create policy "Auth write members" on public.members for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth write events" on public.events for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth write attendance" on public.attendance for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth write items" on public.items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth write bids" on public.bids for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.user_roles;
