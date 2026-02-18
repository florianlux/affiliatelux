-- Supabase schema for DropCharge tracking

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  slug text,
  platform text,
  amount text,
  utm_source text,
  utm_campaign text,
  referrer text,
  user_agent text,
  country text,
  region text,
  ip_hash text
);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text unique not null,
  confirmed boolean default true
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  utm_source text,
  utm_campaign text,
  referrer text,
  meta jsonb
);

create table if not exists public.spotlights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  cover_url text,
  description text,
  amazon_url text,
  g2g_url text,
  release_date text,
  price text
);

create table if not exists public.admin_sessions (
  token text primary key,
  ip text,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text,
  created_at timestamptz default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  event text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists admin_login_attempts_ip_created_idx on public.admin_login_attempts (ip, created_at desc);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);
