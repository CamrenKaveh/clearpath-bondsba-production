-- Migration 008: user_integrations for QB sync tracking
create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('quickbooks')),
  last_synced_at timestamptz,
  realm_id text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.user_integrations enable row level security;

create policy "Users can view own integrations"
  on public.user_integrations for select
  using (auth.uid() = user_id);

create policy "Users can insert own integrations"
  on public.user_integrations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own integrations"
  on public.user_integrations for update
  using (auth.uid() = user_id);
