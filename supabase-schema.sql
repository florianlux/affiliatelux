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

create table if not exists public.auto_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  amazon_asin text not null unique,
  amazon_url text not null,
  product_name text not null,
  product_image text,
  price text,
  rating float,
  reviews_count int,
  description text,
  
  affiliate_key text not null,
  page_slug text not null unique,
  
  view_count int default 0,
  click_count int default 0,
  
  status text default 'active',
  is_featured boolean default false,
  
  metadata jsonb
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null,
  status text default 'active',
  source text,
  utm_source text,
  utm_campaign text,
  utm_medium text,
  utm_content text,
  utm_term text,
  meta jsonb,
  last_sent_at timestamptz,
  unsubscribed_at timestamptz,
  unique(lower(email))
);

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  slug text unique,
  subject text,
  sent_at timestamptz,
  sent_count int default 0,
  failed_count int default 0,
  meta jsonb
);

create table if not exists public.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  campaign_id uuid references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete cascade,
  status text default 'pending',
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz
);

create index if not exists admin_login_attempts_ip_created_idx on public.admin_login_attempts (ip, created_at desc);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);
create index if not exists auto_products_affiliate_idx on public.auto_products (affiliate_key);
create index if not exists auto_products_status_idx on public.auto_products (status);
create index if not exists auto_products_featured_idx on public.auto_products (is_featured);
create index if not exists newsletter_subscribers_email_idx on public.newsletter_subscribers (lower(email));
create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers (status);
create index if not exists newsletter_subscribers_created_idx on public.newsletter_subscribers (created_at desc);
create index if not exists newsletter_campaigns_slug_idx on public.newsletter_campaigns (slug);
create index if not exists newsletter_sends_subscriber_idx on public.newsletter_sends (subscriber_id);
create index if not exists newsletter_sends_campaign_idx on public.newsletter_sends (campaign_id);
