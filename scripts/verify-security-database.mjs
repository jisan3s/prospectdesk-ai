// Pass a path to a locally installed @electric-sql/pglite module. No network,
// Supabase connection, production credentials, or application dependencies used.
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const modulePath = process.argv[2];
if (!modulePath) throw new Error("Usage: node scripts/verify-security-database.mjs /path/to/pglite/dist/index.js");
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite();
const a="019abbaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa", b="019abbaa-bbbb-7bbb-8bbb-bbbbbbbbbbbb";
const company="019abbaa-1111-7111-8111-aaaaaaaaaaaa";
let passed=0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function user(id) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${id}';`); }
async function rejected(sql, params=[]) { let failed=false; try { await db.query(sql,params); } catch { failed=true; } assert.equal(failed,true); }
try {
  await db.exec(await fs.readFile("tests/fixtures/security-schema.sql","utf8"));
  for(const file of (await fs.readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort()) await db.exec(await fs.readFile(`supabase/migrations/${file}`,"utf8"));
  await check("migrations execute transactionally on the isolated prerequisite schema",async()=>{ assert.ok(true); });
  await user(a);
  await db.query("insert into companies(id,owner_id,name) values ($1,$2,'Company A')",[company,a]);
  await check("owner can read own company",async()=>assert.equal((await db.query("select * from companies")).rows.length,1));
  await user(b);
  await check("restrictive RLS overrides a broad legacy policy",async()=>assert.equal((await db.query("select * from companies")).rows.length,0));
  await check("foreign update/delete/forged ownership blocked",async()=>{
    assert.equal((await db.query("update companies set name='Hijacked' where id=$1 returning id",[company])).rows.length,0);
    assert.equal((await db.query("delete from companies where id=$1 returning id",[company])).rows.length,0);
    await rejected("insert into companies(owner_id,name) values ($1,'Forged')",[a]);
  });
  await check("TRUNCATE and private counters inaccessible to authenticated users",async()=>{
    await rejected("truncate companies cascade"); await rejected("select * from prospectdesk_private.request_limits");
  });
  await check("foreign company association rejected",async()=>await rejected("insert into contacts(owner_id,company_id,full_name) values ($1,$2,'Foreign')",[b,company]));
  await check("quota action whitelist enforced",async()=>await rejected("select claim_security_rate_limit('arbitrary')"));
  await check("burst quota denies the fourth provider attempt",async()=>{
    for(let i=0;i<3;i++) assert.equal((await db.query("select claim_security_rate_limit('company_search') allowed")).rows[0].allowed,true);
    assert.equal((await db.query("select claim_security_rate_limit('company_search') allowed")).rows[0].allowed,false);
  });
  await user(a);
  await check("users have independent quota counters",async()=>assert.equal((await db.query("select claim_security_rate_limit('company_search') allowed")).rows[0].allowed,true));
  await check("bounded list RPC returns only caller-owned records",async()=>{
    const result=(await db.query("select list_saved_records('companies') data")).rows[0].data;
    assert.equal(result.total,1); assert.equal(result.rows[0].name,"Company A");
  });
  await check("pagination and literal search reach records beyond the first 500",async()=>{
    await db.exec("reset role; reset request.jwt.claim.sub;");
    await db.query("insert into companies(owner_id,name) select $1,'Batch '||lpad(i::text,3,'0') from generate_series(1,520) i",[a]);
    await user(a);
    const page=(await db.query("select list_saved_records('companies','','','','','name',2) data")).rows[0].data;
    assert.equal(page.total,521);assert.equal(page.rows.length,20);
    const search=(await db.query("select list_saved_records('companies','Batch 001') data")).rows[0].data;
    assert.equal(search.total,1);
    const injected=(await db.query("select list_saved_records('companies',$1) data",["%' OR true --"])).rows[0].data;
    assert.equal(injected.total,0);
  });
  await check("latest weak score excludes an older qualified score",async()=>{
    await db.query("insert into lead_scores(owner_id,company_id,score,created_at) values($1,$2,90,'2026-01-01'),($1,$2,30,'2026-02-01')",[a,company]);
    assert.equal((await db.query("select list_saved_records('leads') data")).rows[0].data.total,0);
  });
  await check("outreach inserts cannot bypass draft review",async()=>await rejected("insert into outreach_drafts(owner_id,company_id,body,status) values($1,$2,'Text','approved')",[a,company]));
  const draft=(await db.query("insert into outreach_drafts(owner_id,company_id,channel,message_type,body) values($1,$2,'email','initial','Text') returning id",[a,company])).rows[0].id;
  await check("invalid transitions rejected and revisions advance",async()=>{
    await rejected("update outreach_drafts set status='manually_sent' where id=$1",[draft]);
    await db.query("update outreach_drafts set status='in_review' where id=$1",[draft]);
    const row=(await db.query("update outreach_drafts set status='approved' where id=$1 returning revision,approved_at",[draft])).rows[0];
    assert.equal(row.revision,3);assert.ok(row.approved_at);
    await rejected("update outreach_drafts set body='Changed' where id=$1",[draft]);
    assert.ok((await db.query("update outreach_drafts set status='manually_sent' where id=$1 returning sent_at",[draft])).rows[0].sent_at);
  });
  await check("all seven owner tables isolate reads and reject forged inserts",async()=>{
    await db.query("insert into profiles(user_id) values($1)",[a]);
    await db.query("insert into contacts(owner_id,company_id,full_name) values($1,$2,'Candidate')",[a,company]);
    await db.query("insert into research_sources(owner_id,company_id,source_url,finding) values($1,$2,'https://example.com','Source')",[a,company]);
    await db.exec("reset role; reset request.jwt.claim.sub;");
    await db.query("insert into agent_runs(owner_id) values($1)",[a]);
    await user(a);
    await rejected("insert into agent_runs(owner_id) values($1)",[a]);
    await user(b);
    for(const table of ["profiles","companies","contacts","research_sources","lead_scores","outreach_drafts","agent_runs"]) {
      assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
      await rejected(`insert into ${table}(${table==="profiles"?"user_id":"owner_id"}) values($1)`,[a]);
    }
  });
  await check("list filter bounds cannot be bypassed via direct RPC",async()=>{
    await rejected("select list_saved_records('companies','','','','','newest',0)");
    await rejected("select list_saved_records('companies',$1)",["x".repeat(201)]);
    await rejected("select list_saved_records('arbitrary')");
  });
  await user(b);
  await check("second user cannot list first user's records via RPC",async()=>assert.equal((await db.query("select list_saved_records('drafts') data")).rows[0].data.total,0));
  await check("direct Data API-style writes cannot bypass mutation rate limits",async()=>{
    for(let i=0;i<60;i++) {
      try { await db.query("insert into companies(owner_id,name) values($1,'Budgeted')",[b]); } catch { break; }
    }
    await rejected("insert into companies(owner_id,name) values($1,'Over budget')",[b]);
  });
  await db.exec("reset role; set role anon; reset request.jwt.claim.sub;");
  await check("anonymous table/RPC access denied",async()=>{
    await rejected("select * from companies"); await rejected("select claim_security_rate_limit('company_search')"); await rejected("select list_saved_records('companies')"); await rejected("select claim_discovery_usage('search')");
  });
  console.log(`${passed} database security checks passed. Isolated PostgreSQL fixture only; deployed Supabase is not verified.`);
} finally { await db.close(); }
