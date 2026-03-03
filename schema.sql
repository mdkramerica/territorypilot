-- RouteIQ Supabase Schema
-- Run in Supabase SQL editor

-- Users (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  plan text default 'free',
  plan_active boolean default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- Accounts (territory accounts)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  address text,
  lat float,
  lng float,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  last_visited date,
  visit_frequency_days int default 30,
  priority int default 2,  -- 1=high, 2=medium, 3=low
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- Call logs
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  transcript text,
  summary text,
  outcome text,  -- 'positive', 'neutral', 'needs_followup', 'closed'
  created_at timestamptz default now()
);

-- AI briefs (cached)
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  brief text not null,
  created_at timestamptz default now()
);

-- Route plans
create table if not exists public.route_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  plan_date date not null,
  account_order jsonb,  -- ordered array of account IDs
  total_miles float,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.call_logs enable row level security;
alter table public.briefs enable row level security;
alter table public.route_plans enable row level security;

create policy "Users can access own data" on public.users for all using (auth.uid() = id);
create policy "Users can access own accounts" on public.accounts for all using (auth.uid() = user_id);
create policy "Users can access own logs" on public.call_logs for all using (auth.uid() = user_id);
create policy "Users can access own briefs" on public.briefs for all using (auth.uid() = user_id);
create policy "Users can access own routes" on public.route_plans for all using (auth.uid() = user_id);

-- Index for performance
create index accounts_user_id_idx on public.accounts(user_id);
create index call_logs_account_id_idx on public.call_logs(account_id);
create index call_logs_user_date_idx on public.call_logs(user_id, created_at desc);
