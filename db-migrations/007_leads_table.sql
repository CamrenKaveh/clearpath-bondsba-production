-- db-migrations/007_leads_table.sql
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  company_type text,
  source      text,
  page        text,
  created_at  timestamptz default now()
);

-- Allow anon inserts (lead capture is intentionally public).
alter table public.leads enable row level security;

create policy "Anyone can insert a lead"
  on public.leads for insert
  to anon, authenticated
  with check (true);

-- Only authenticated service role can read leads (admin use only).
create policy "Service role reads leads"
  on public.leads for select
  to service_role
  using (true);
