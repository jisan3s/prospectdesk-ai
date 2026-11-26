-- READ ONLY: run before/after the hardening overlay on the approved project.
-- Save results privately. This reports configuration; it does not change data.
select n.nspname schema_name, c.relname table_name, c.relrowsecurity rls_enabled,
       c.relforcerowsecurity force_rls,
       has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') anon_has_any_access,
       has_table_privilege('authenticated',c.oid,'TRUNCATE') authenticated_can_truncate
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by c.relname;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' order by tablename,policyname;

-- Investigate every callable SECURITY DEFINER function, particularly functions
-- not covered by this overlay. RLS is bypassed by their owners in many setups.
select p.oid::regprocedure function_name, p.prosecdef security_definer,
       p.proconfig function_settings,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_callable,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_callable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname;

select event_object_table,trigger_name,action_timing,event_manipulation,action_statement
from information_schema.triggers where trigger_schema='public'
order by event_object_table,trigger_name;

select rolname,rolsuper,rolbypassrls,rolconfig from pg_roles
where rolname in ('anon','authenticated','service_role','authenticator');
