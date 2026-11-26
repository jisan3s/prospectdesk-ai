-- Hardening overlay for the existing Stage 1–7 schema, NOT a replacement schema.
-- Apply to an isolated staging copy first. Missing prerequisite tables abort the
-- transaction; existing policies/functions/data are not deleted.
begin;
set local lock_timeout = '5s';

create schema if not exists prospectdesk_private;
revoke all on schema prospectdesk_private from public, anon, authenticated;
create table prospectdesk_private.request_limits (
  user_id uuid not null,
  action text not null,
  window_seconds integer not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (user_id, action, window_seconds)
);
alter table prospectdesk_private.request_limits enable row level security;
revoke all on prospectdesk_private.request_limits from public, anon, authenticated;

create function public.claim_security_rate_limit(p_action text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare
  caller uuid := auth.uid();
  ceiling integer;
  window_size integer;
  bucket timestamptz;
  used integer;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_action not in ('profile_analyze','company_search','company_research','lead_score','decision_search','outreach_generate','record_write','record_list') or p_action is null then
    raise exception 'Invalid rate action' using errcode = '22023';
  end if;
  foreach window_size in array array[60,3600] loop
    ceiling := case
      when p_action = 'record_list' then case when window_size = 60 then 120 else 2000 end
      when p_action = 'record_write' then case when window_size = 60 then 60 else 1000 end
      when window_size = 60 then 3
      when p_action = 'profile_analyze' then 3
      when p_action = 'company_search' then 15
      when p_action = 'outreach_generate' then 10
      else 5 end;
    bucket := to_timestamp(floor(extract(epoch from statement_timestamp()) / window_size) * window_size);
    insert into prospectdesk_private.request_limits as counters values (caller,p_action,window_size,bucket,1)
    on conflict (user_id,action,window_seconds) do update
      set attempts = case when counters.window_start = excluded.window_start then least(counters.attempts + 1, ceiling + 1) else 1 end,
          window_start = excluded.window_start
      returning attempts into used;
    if used > ceiling then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.claim_security_rate_limit(text) from public, anon;
grant execute on function public.claim_security_rate_limit(text) to authenticated;

-- Apply the same write budget to direct authenticated Data API mutations,
-- not just requests passing through Next.js. Bound each newly written row too.
create function prospectdesk_private.guard_record_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if auth.uid() is not null then
    if not public.claim_security_rate_limit('record_write') then
      raise exception 'Record mutation limit reached' using errcode = 'P0001';
    end if;
    if TG_OP <> 'DELETE' and octet_length(to_jsonb(new)::text) > 262144 then
      raise exception 'Record exceeds the storage limit' using errcode = '23514';
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function prospectdesk_private.guard_record_mutation() from public, anon, authenticated;

-- A restrictive guard intersects existing policies, including broad legacy ones.
-- Add owner access only to tables with NO existing permissive policy, so existing
-- business restrictions are never widened by a new permissive OR branch.
do $$
declare
  t text;
  owner_column text;
  predicate text;
begin
  foreach t in array array['profiles','companies','contacts','research_sources','lead_scores','outreach_drafts','agent_runs'] loop
    if to_regclass('public.' || t) is null then raise exception 'Missing Stage 1–7 prerequisite table: %', t; end if;
    owner_column := case when t = 'profiles' then 'user_id' else 'owner_id' end;
    predicate := format('%I = (select auth.uid())',owner_column);
    if t in ('contacts','research_sources','lead_scores','outreach_drafts') then
      predicate := predicate || format(' and exists (select 1 from public.companies c where c.id = %I.company_id and c.owner_id = (select auth.uid()))', t);
    end if;
    if t = 'outreach_drafts' then
      predicate := predicate || ' and (contact_id is null or exists (select 1 from public.contacts ct where ct.id = outreach_drafts.contact_id and ct.company_id = outreach_drafts.company_id and ct.owner_id = (select auth.uid())))';
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger security_record_mutation before insert or update or delete on public.%I for each row execute function prospectdesk_private.guard_record_mutation()', t);
    execute format('revoke all on public.%I from public, anon',t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated',t);
    if not exists (select 1 from pg_policy where polrelid = ('public.' || t)::regclass and polpermissive) then
      execute format('create policy security_owner_access on public.%I as permissive for all to authenticated using (%s) with check (%s)',t,predicate,predicate);
    end if;
    execute format('create policy security_owner_boundary on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t,predicate,predicate);
    if t <> 'profiles' then
      execute format('create index if not exists %I on public.%I (%I)', 'security_'||t||'_owner', t, owner_column);
    end if;
  end loop;
end $$;
create index if not exists security_latest_company_score on public.lead_scores (owner_id, company_id, created_at desc, id desc);
create index if not exists security_company_sources on public.research_sources (owner_id, company_id, created_at desc);

-- Keep existing daily quotas and their implementation; prevent anonymous calls.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('claim_profile_analysis_quota','claim_discovery_usage','claim_qualification_usage','claim_outreach_generation','claim_api_hourly_limit','save_discovered_company') loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

-- Enforce the existing outreach state machine even for direct Data API writes.
create function prospectdesk_private.guard_outreach_workflow()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' or new.approved_at is not null or new.sent_at is not null then
      raise exception 'New messages must be unapproved drafts' using errcode = '23514';
    end if;
    new.revision := 1;
  else
    if (new.owner_id,new.company_id,new.contact_id,new.channel,new.message_type) is distinct from
       (old.owner_id,old.company_id,old.contact_id,old.channel,old.message_type) then
      raise exception 'Draft associations are immutable' using errcode = '23514';
    end if;
    if old.status in ('approved','manually_sent') and (new.body,new.subject) is distinct from (old.body,old.subject) then
      raise exception 'Approved content is immutable' using errcode = '23514';
    end if;
    if new.status <> old.status and not (
      (old.status='draft' and new.status='in_review') or
      (old.status='in_review' and new.status in ('approved','rejected','draft')) or
      (old.status='rejected' and new.status='draft') or
      (old.status='approved' and new.status='manually_sent')
    ) then raise exception 'Invalid outreach transition' using errcode = '23514'; end if;
    if (new.body,new.subject) is distinct from (old.body,old.subject) and new.status <> 'draft' then
      raise exception 'Edited messages require review again' using errcode = '23514';
    end if;
    new.revision := old.revision + 1;
    new.approved_at := case when new.status='approved' and old.status<>'approved' then statement_timestamp() else old.approved_at end;
    new.sent_at := case when new.status='manually_sent' and old.status<>'manually_sent' then statement_timestamp() else old.sent_at end;
  end if;
  if new.status is null or new.status not in ('draft','in_review','approved','rejected','manually_sent') then
    raise exception 'Invalid outreach status' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function prospectdesk_private.guard_outreach_workflow() from public, anon, authenticated;
create trigger security_outreach_workflow before insert or update on public.outreach_drafts
for each row execute function prospectdesk_private.guard_outreach_workflow();
commit;
