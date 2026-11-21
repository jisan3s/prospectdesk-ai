-- Stage 3: additive migration for the Stage 2 schema.
-- Preserve existing profiles, companies, authentication and RLS.
alter table public.profiles
  add column if not exists raw_profile_text text not null default '',
  add column if not exists scout_analysis jsonb,
  add column if not exists analyzed_at timestamptz,
  add column if not exists analysis_model text,
  add column if not exists analysis_input_tokens integer,
  add column if not exists analysis_output_tokens integer;

-- Enforce a server-side quota atomically, across server instances.
-- Users cannot directly modify this table.
create table if not exists public.profile_analysis_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  usage_count integer not null default 0 check (usage_count between 0 and 3),
  primary key (user_id, usage_date)
);
alter table public.profile_analysis_quota enable row level security;
revoke all on public.profile_analysis_quota from anon, authenticated;

create or replace function public.claim_profile_analysis_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  allowed boolean;
begin
  if caller is null then
    return false;
  end if;

  with claimed as (
    insert into public.profile_analysis_quota (user_id, usage_date, usage_count)
    values (caller, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, usage_date)
    do update set usage_count = public.profile_analysis_quota.usage_count + 1
      where public.profile_analysis_quota.usage_count < 3
    returning 1
  )
  select exists(select 1 from claimed) into allowed;

  return allowed;
end;
$$;

revoke all on function public.claim_profile_analysis_quota() from public, anon;
grant execute on function public.claim_profile_analysis_quota() to authenticated;
