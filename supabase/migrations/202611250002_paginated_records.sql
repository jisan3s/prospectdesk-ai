begin;
-- Read-only, owner-scoped, bounded output. Invoker rights retain every RLS rule.
create function public.list_saved_records(
  p_kind text, p_search text default '', p_status text default '',
  p_company text default '', p_channel text default '', p_sort text default 'newest',
  p_page integer default 1
) returns jsonb language plpgsql security invoker set search_path = pg_catalog
set statement_timeout = '5s' as $$
declare
  caller uuid := auth.uid();
  relation text;
  order_by text;
  fields text[];
  query text;
  result jsonb;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('companies','contacts','leads','drafts') or
     p_sort is null or p_sort not in ('newest','oldest','name','score') or
     p_page is null or p_page < 1 or p_page > 100000 or
     p_search is null or length(p_search)>200 or p_status is null or length(p_status)>80 or
     p_company is null or length(p_company)>36 or p_channel is null or p_channel not in ('','email','linkedin') then
    raise exception 'Invalid record filters' using errcode='22023';
  end if;
  relation := case p_kind when 'companies' then 'public.companies' when 'contacts' then 'public.contacts'
    when 'drafts' then 'public.outreach_drafts'
    else '(select distinct on (company_id) * from public.lead_scores where owner_id = $1 order by company_id, created_at desc, id desc)' end;
  fields := case p_kind
    when 'companies' then array['id','name','website','industry','location','status','research_summary','created_at']
    when 'contacts' then array['id','company_id','full_name','job_title','verification_source','linkedin_url','notes','created_at']
    when 'leads' then array['id','company_id','score','confidence','reasoning','evidence','created_at']
    else array['id','company_id','contact_id','channel','message_type','subject','body','status','approved_at','sent_at','created_at'] end;
  order_by := case p_sort when 'oldest' then 'created_at asc, id asc' when 'name' then 'title asc, id asc'
    when 'score' then 'score desc nulls last, created_at desc, id desc' else 'created_at desc, id desc' end;
  -- Table, fields, and ordering come only from the whitelists above. All user
  -- values are bound parameters. Search is literal, not a SQL/filter expression.
  query := format($q$
    with candidates as (
      select r.id, r.created_at,
        coalesce(j->>'full_name', j->>'subject', c.name, j->>'name', '') title,
        (j->>'score')::numeric score, coalesce(c.name,j->>'name','Company unavailable') company_name,
        coalesce(j->>'company_id',r.id::text) company_id,
        coalesce(j->>'status','') status, coalesce(j->>'channel','') channel,
        concat_ws(' ', c.name,j->>'name',j->>'full_name',j->>'job_title',j->>'subject',j->>'body',j->>'industry',j->>'location',j->>'notes',j->>'reasoning',j->>'research_summary',j->>'website') search_text,
        (select jsonb_object_agg(k,case
          when k='evidence' then coalesce((select jsonb_agg(jsonb_build_object('url',left(item->>'url',2048),'finding',left(item->>'finding',1500))) from (select value item from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) limit 8) bounded),'[]'::jsonb)
          when jsonb_typeof(v)='string' then to_jsonb(left(v#>>'{}',5000)) else v end)
         from jsonb_each(j) e(k,v) where k=any($9)) row_data,
        ct.full_name contact_name
      from %s r
      cross join lateral (select to_jsonb(r) j) raw
      left join public.companies c on c.id::text=coalesce(j->>'company_id',r.id::text) and c.owner_id=$1
      left join public.contacts ct on ct.id::text=j->>'contact_id' and ct.owner_id=$1
      where r.owner_id=$1 and ($2 <> 'leads' or (j->>'score')::numeric >= 70)
    ), filtered as (
      select * from candidates where ($3='' or strpos(lower(search_text),lower($3))>0)
        and ($4='' or status=$4) and ($5='' or company_id=$5) and ($6='' or channel=$6)
    ), page_rows as (
      select * from filtered order by %s limit 20 offset (($7::bigint-1)*20)
    )
    select jsonb_build_object(
      'total',(select count(*) from filtered), 'savedTotal',(select count(*) from candidates),
      'companies',coalesce((select jsonb_agg(x) from (select distinct company_id id,company_name name from candidates order by company_name limit 100) x),'[]'::jsonb),
      'statuses',coalesce((select jsonb_agg(status) from (select distinct status from candidates where status<>'' order by status limit 50) s),'[]'::jsonb),
      'rows',coalesce((select jsonb_agg(row_data || jsonb_build_object(
        '_company', company_name, '_contact', contact_name,
        '_sources', case when $2='companies' then coalesce((select jsonb_agg(s) from (
          select left(source_url,2048) source_url,left(finding,1500) finding from public.research_sources where owner_id=$1 and company_id=page_rows.id order by created_at desc,id desc limit 50
        ) s),'[]'::jsonb) else '[]'::jsonb end
      ) order by %s) from page_rows),'[]'::jsonb)
    )
  $q$,relation,order_by,order_by);
  execute query into result using caller,p_kind,p_search,p_status,p_company,p_channel,p_page,p_sort,fields;
  return result;
end $$;
revoke all on function public.list_saved_records(text,text,text,text,text,text,integer) from public, anon;
grant execute on function public.list_saved_records(text,text,text,text,text,text,integer) to authenticated;
commit;
