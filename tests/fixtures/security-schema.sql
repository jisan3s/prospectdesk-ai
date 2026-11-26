-- Minimal isolated fixture for migration execution; NOT the missing production schema.
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.profiles (user_id uuid primary key, created_at timestamptz default now());
create table public.companies (id uuid primary key default gen_random_uuid(), owner_id uuid not null, name text, website text, industry text, location text, status text default 'new', research_summary text, created_at timestamptz default now());
create table public.contacts (id uuid primary key default gen_random_uuid(), owner_id uuid not null, company_id uuid references companies(id), full_name text, job_title text, verification_source text, linkedin_url text, notes text, created_at timestamptz default now());
create table public.research_sources (id uuid primary key default gen_random_uuid(), owner_id uuid not null, company_id uuid references companies(id), source_url text, finding text, created_at timestamptz default now());
create table public.lead_scores (id uuid primary key default gen_random_uuid(), owner_id uuid not null, company_id uuid references companies(id), score integer, confidence text, reasoning text, evidence jsonb, created_at timestamptz default now());
create table public.outreach_drafts (id uuid primary key default gen_random_uuid(), owner_id uuid not null, company_id uuid references companies(id), contact_id uuid references contacts(id), channel text, message_type text, subject text, body text, status text default 'draft', approved_at timestamptz, sent_at timestamptz, revision integer default 1, created_at timestamptz default now());
create table public.agent_runs (id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_at timestamptz default now());
grant select,insert,update,delete,truncate on all tables in schema public to authenticated, anon;
-- Intentionally broad legacy policies: restrictive hardening must still isolate users.
alter table public.companies enable row level security;
create policy legacy_broad_access on public.companies for all to authenticated using (true) with check (true);

create function public.claim_discovery_usage(p_action text) returns boolean language sql security definer as $$ select true $$;

alter table public.agent_runs enable row level security;
create policy existing_read_only on public.agent_runs for select to authenticated using (owner_id = auth.uid());
