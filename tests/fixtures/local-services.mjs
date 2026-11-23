/** Local HTTP test double. No real Supabase project, external provider, or SMTP transport. */
import http from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.TEST_SERVICE_PORT || 54329);
const users = [
  { id: "019abbaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa", email: "e2e-a@example.test" },
  { id: "019abbaa-bbbb-7bbb-8bbb-bbbbbbbbbbbb", email: "e2e-b@example.test" },
];
const names = ["profiles", "companies", "research_sources", "contacts", "lead_scores", "outreach_drafts", "agent_runs"];
const audit={records:[],calls:{}};
let state;
const reset = () => { state = { tables: Object.fromEntries(names.map(n => [n, []])), faults: {}, requests: [], quotas: {}, revoked: [] }; };
reset();
const now = () => new Date().toISOString();
const authUser = token => {
  try { const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url")); return users.find(u => u.id === claims.sub && claims.exp > Date.now() / 1000 && !state.revoked.includes(u.id)); } catch { return undefined; }
};
const jwt = user => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iss: `http://127.0.0.1:${port}/auth/v1`, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url"), "synthetic-signature"].join(".");
const authShape = user => ({ ...user, aud: "authenticated", role: "authenticated", email_confirmed_at: now(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: now() });
const matches = (row, params) => [...params].every(([key, value]) => {
  if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) return true;
  const [op, ...rest] = value.split("."); const v = rest.join(".");
  if (op === "eq") return String(row[key]) === v;
  if (op === "is") return v === "null" ? row[key] == null : String(row[key]) === v;
  if (op === "in") return v.replace(/^\(|\)$/g, "").split(",").includes(String(row[key]));
  return false;
});
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "http://127.0.0.1:3000");
  res.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, HEAD, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
  const send = (status, data) => { res.statusCode=status; if (status===204) return res.end(); res.setHeader("Content-Type", "application/json"); res.end(req.method === "HEAD" ? undefined : JSON.stringify(data)); };
  if (req.method === "OPTIONS") return send(204);
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let raw=""; for await (const chunk of req) raw += chunk;
  let body={}; try { body=raw ? JSON.parse(raw) : {}; } catch { return send(400,{message:"Invalid JSON"}); }
  if (url.pathname === "/__test/reset") { reset(); return send(200,{reset:true}); }
  if (url.pathname === "/__test/faults") { Object.assign(state.faults,body); return send(200,{configured:true}); }
  if (url.pathname === "/__test/revoke") { state.revoked.push(body.id); return send(200,{revoked:true}); }
  if (url.pathname === "/__test/state") return send(200,state);
  if (url.pathname === "/__test/audit") return send(200,audit);
  const callKey=`${req.method} ${url.pathname}`; audit.calls[callKey]=(audit.calls[callKey]||0)+1;
  state.requests.push({ method:req.method, path:url.pathname, query:url.search, body });
  if (url.pathname.startsWith("/auth/v1")) {
    if (url.pathname.endsWith("/token")) {
      const user = users.find(u => u.email===body.email);
      if (!user || body.password!=="E2E-password-123") return send(400,{code:"invalid_credentials",msg:"Invalid login credentials"});
      return send(200,{ access_token:jwt(user), token_type:"bearer", expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, refresh_token:"synthetic-refresh", user:authShape(user) });
    }
    if (url.pathname.endsWith("/signup")) return send(200,{user:authShape(users[0]),session:null});
    if (url.pathname.endsWith("/verify")) {
      if (body.token_hash !== "synthetic-confirmation") return send(403,{code:"otp_expired",msg:"Confirmation expired"});
      const user=users[0];
      return send(200,{access_token:jwt(user),token_type:"bearer",expires_in:3600,refresh_token:"synthetic-refresh",user:authShape(user)});
    }
    if (url.pathname.endsWith("/logout")) return send(204);
    const user=authUser((req.headers.authorization||"").replace(/^Bearer /,""));
    return user ? send(200,authShape(user)) : send(401,{code:"bad_jwt",msg:"Session expired"});
  }
  if (url.pathname === "/tavily/search") {
    if (state.faults.tavily) return send(503,{error:"Synthetic search outage"});
    if (state.faults.emptySearch) return send(200,{results:[]});
    return send(200,{results:[{title:"[E2E TEST] Sample Company",url:"https://example.com/services",content:"A fictional consulting business with professional services. Contact candidate: Test Person, Operations Director."}]});
  }
  if (url.pathname === "/openai/v1/responses") {
    if (state.faults.openai) return send(503,{error:{message:state.faults.providerDiagnostic||"Synthetic provider outage",type:"server_error"}});
    const format=body.text?.format?.name;
    const assessment={score:state.faults.weakScore ? 32 : 78,confidence:state.faults.weakScore ? "low" : "medium",reasoning:"Fictional company evidence aligns with the saved services; budget is unknown.",positive_signals:["Service alignment"],risks:["Budget not established"],evidence_indexes:[0],suggested_roles:[{title:"Operations Director",rationale:"A possible buyer role, requiring verification."}]};
    const outputs={
      scout_profile_analysis:{positioning_statement:"Web development for service businesses.",verified_strengths:["User-supplied TypeScript experience"],suggested_services:["Website development"],ideal_clients:[{industry:"Consulting",buyer_role:"Operations Director",why_relevant:"Matches supplied services."}],missing_information:["Project results"],cautions:["Verify suggestions."]},
      scout_company_research:{summary:"A fictional consulting company.",potential_opportunity:"Website services may be relevant; no need is confirmed.",relevance_to_profile:"Matches website development services.",confidence:"medium",evidence_indexes:[0],caveats:["Synthetic test evidence only."]},
      scout_qualification:assessment,
      scout_outreach_draft:{subject:"A website conversation",body:"Hello Test Person, I offer website development for consulting businesses. Would a brief conversation be useful?",personalization_facts:["User offers website development"],cautions:["Verify the current role before outreach."]},
    };
    const output=state.faults.invalidAI ? {unexpected:true} : outputs[format];
    return send(200,{id:"resp_synthetic",object:"response",created_at:Math.floor(Date.now()/1000),status:"completed",model:"synthetic",error:null,incomplete_details:null,output:[{id:"msg_synthetic",type:"message",status:"completed",role:"assistant",content:[{type:"output_text",text:JSON.stringify(output),annotations:[]}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}});
  }
  const user=authUser((req.headers.authorization||"").replace(/^Bearer /,""));
  if (!user) return send(401,{message:"Unauthorized",code:"PGRST301"});
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const rpc=url.pathname.split("/").pop();
    if (state.faults.quotaUnavailable) return send(503,{message:"Synthetic quota failure",code:"TEST"});
    if (rpc.startsWith("claim_")) {
      if (state.faults.rateLimit) return send(200,false);
      const k=`${user.id}:${rpc}:${body.p_action||""}`; state.quotas[k]=(state.quotas[k]||0)+1;
      return send(200,true);
    }
    if (rpc==="save_discovered_company") {
      const host=new URL(body.p_website).hostname;
      if (state.tables.companies.some(c=>c.owner_id===user.id && c.website_host===host)) return send(409,{code:"23505",message:"Duplicate"});
      const company={id:randomUUID(),owner_id:user.id,name:body.p_name,website:body.p_website,website_host:host,industry:body.p_industry,location:body.p_location,research_summary:body.p_summary,created_at:now(),status:"new"};
      state.tables.companies.push(company);
      audit.records.push({table:"companies",id:company.id,owner_id:user.id});
      for (const s of body.p_sources) state.tables.research_sources.push({id:randomUUID(),owner_id:user.id,company_id:company.id,source_url:s.url,source_title:s.title,finding:s.finding,created_at:now()});
      return send(200,company.id);
    }
    return send(404,{message:"Unknown test RPC"});
  }
  const table=url.pathname.split("/").pop();
  if (!state.tables[table]) return send(404,{message:"Unknown test table"});
  if (state.faults.database===table || state.faults.database===true) return send(503,{message:"Synthetic database failure",code:"TEST"});
  if (state.faults.readDelay && req.method === "GET") await new Promise(resolve => setTimeout(resolve, Number(state.faults.readDelay)));
  const ownerKey=table==="profiles" ? "user_id" : "owner_id";
  let rows=state.tables[table].filter(row=>row[ownerKey]===user.id && matches(row,url.searchParams));
  if (req.method==="GET" || req.method==="HEAD") {
    const count=rows.length;
    const order=url.searchParams.get("order"); if (order) { const [key,direction]=order.split("."); rows.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(direction==="desc" ? -1 : 1)); }
    rows=rows.slice(Number(url.searchParams.get("offset")||0),Number(url.searchParams.get("limit")||rows.length));
    res.setHeader("Content-Range",`0-${Math.max(0,rows.length-1)}/${count}`);
  } else if (req.method==="POST") {
    const items=Array.isArray(body) ? body : [body]; rows=[];
    for (const item of items) {
      const existing=table==="profiles" ? state.tables.profiles.find(p=>p.user_id===user.id) : null;
      const record=existing || {id:randomUUID(),created_at:now(),revision:1};
      Object.assign(record,item,{[ownerKey]:user.id,updated_at:now()});
      if (table==="companies" && item.website) record.website_host=new URL(item.website).hostname;
      if (!existing) { state.tables[table].push(record); audit.records.push({table,id:record.user_id||record.id,owner_id:user.id}); } rows.push(record);
    }
  } else if (req.method==="PATCH") {
    for (const row of rows) {
      Object.assign(row,body,{updated_at:now()});
      if (table==="outreach_drafts") { row.revision++; if (body.status==="approved") row.approved_at=now(); if (body.status==="manually_sent") row.sent_at=now(); }
    }
  } else return send(405,{message:"Method not supported by service double"});
  const select=url.searchParams.get("select");
  if (select && select!=="*") rows=rows.map(row=>Object.fromEntries(select.split(",").map(key=>[key,row[key]??null])));
  if (req.headers.accept?.includes("vnd.pgrst.object")) {
    if (rows.length!==1) return send(406,{code:"PGRST116",message:"Expected one row",details:`The result contains ${rows.length} rows`});
    return send(200,rows[0]);
  }
  return send(200,rows);
});
server.listen(port,"127.0.0.1",()=>console.log(`Synthetic services listening on 127.0.0.1:${port}`));
