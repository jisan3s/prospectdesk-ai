// Reconstruct metadata only in an isolated in-memory PostgreSQL instance.
// Never connects to the hosted database or imports production row values.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const [modulePath,snapshotPath] = process.argv.slice(2);
if(!modulePath||!snapshotPath)throw new Error("Pass the local PGlite module and metadata-only snapshot paths");
const {PGlite}=await import(pathToFileURL(path.resolve(modulePath)).href);
const snapshot=JSON.parse(await fs.readFile(snapshotPath,"utf8"));
if(snapshot.data)throw new Error("Refusing a snapshot containing production records");
const db=new PGlite();
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const a="019abbaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa", company="019abbaa-1111-7111-8111-aaaaaaaaaaaa";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create role authenticator;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_user::text$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const grouped=Map.groupBy(snapshot.columns,c=>c.table_name);
  for(const [name,columns] of grouped){
    const defs=columns.sort((a,b)=>a.ordinal_position-b.ordinal_position).map(c=>{
      const type=c.data_type==="ARRAY"?`${quote(c.udt_name.slice(1))}[]`:c.data_type==="USER-DEFINED"?quote(c.udt_name):c.data_type;
      return `${quote(c.column_name)} ${type}${c.column_default?` default ${c.column_default}`:""}${c.is_nullable==="NO"?" not null":""}`;
    });
    await db.exec(`create table public.${quote(name)}(${defs.join(",")});`);
  }
  // FK targets require primary/unique constraints to exist first.
  const constraints=[...(snapshot.constraints||[])].sort((a,b)=>Number(a.definition.startsWith("FOREIGN KEY"))-Number(b.definition.startsWith("FOREIGN KEY")));
  for(const c of constraints)await db.exec(`alter table public.${quote(c.table.replace(/^public\./,""))} add constraint ${quote(c.name)} ${c.definition};`);
  for(const f of snapshot.functions||[])await db.exec(f.definition);
  for(const p of snapshot.policies||[]){
    await db.exec(`create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==="public"?"public":quote(r)).join(",")}${p.qual?` using (${p.qual})`:""}${p.with_check?` with check (${p.with_check})`:""};`);
  }
  for(const r of snapshot.rls||[])if(r.enabled)await db.exec(`alter table public.${quote(r.table)} enable row level security;`);
  for(const g of snapshot.grants||[])if(["PUBLIC","anon","authenticated","service_role"].includes(g.grantee))await db.exec(`grant ${g.privilege_type} on public.${quote(g.table_name)} to ${g.grantee==="PUBLIC"?"public":quote(g.grantee)};`);
  for(const t of snapshot.triggers||[])await db.exec(t.definition);
  for(const i of snapshot.indexes||[]){
    const exists=(await db.query("select to_regclass($1) name",[`public.${i.indexname}`])).rows[0].name;
    if(!exists)await db.exec(i.indexdef);
  }
  console.log(`PASS rebuilt ${grouped.size} public tables, ${snapshot.policies.length} policies and ${snapshot.triggers.length} triggers from actual metadata; no production rows imported`);
  for(const file of (await fs.readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort())await db.exec(await fs.readFile(`supabase/migrations/${file}`,"utf8"));
  console.log("PASS both migrations apply against reconstructed hosted metadata");
  await db.query("insert into auth.users(id) values($1)",[a]);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
  await db.query("insert into profiles(user_id,display_name) values($1,'Synthetic migration test')",[a]);
  await db.query("insert into companies(id,owner_id,name,website) values($1,$2,'Synthetic migration test','https://example.com')",[company,a]);
  const draft=(await db.query("insert into outreach_drafts(owner_id,company_id,channel,message_type,body,subject) values($1,$2,'email','initial','Synthetic message','Test subject') returning id",[a,company])).rows[0];
  for(const [status,revision] of [["in_review",2],["approved",3],["manually_sent",4]]){
    const result=(await db.query("update outreach_drafts set status=$1 where id=$2 returning revision,approved_at,sent_at",[status,draft.id])).rows[0];
    assert.equal(result.revision,revision);
    if(status!=="in_review")assert.ok(result.approved_at);
    if(status==="manually_sent")assert.ok(result.sent_at);
  }
  console.log("PASS new and existing outreach triggers coexist without double revision increments; approval/sent timestamps valid");
  for(const kind of ["companies","contacts","leads","drafts"]){
    const result=(await db.query("select list_saved_records($1) data",[kind])).rows[0].data;
    assert.ok(Array.isArray(result.rows));assert.ok(result.rows.length<=20);
  }
  console.log("PASS all four paginated RPC branches run against the hosted column types and policies");
  console.log("Hosted-metadata compatibility checks passed. This process did not connect to production.");
}finally{await db.close();}
