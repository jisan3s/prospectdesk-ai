import { spawn } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const artifacts=path.resolve(process.env.FINAL_REVIEW_ARTIFACT_DIR || "artifacts/final");
const mode=process.env.FINAL_REVIEW_MODE || "development";
if (!["development", "production"].includes(mode)) throw new Error("FINAL_REVIEW_MODE must be development or production");
fs.mkdirSync(artifacts,{recursive:true});
const children=[];
function start(command,args,env,logName) {
  const log=fs.openSync(path.join(artifacts,logName),"w");
  const child=spawn(command,args,{env:{...process.env,...env},stdio:["ignore",log,log],detached:true});
  children.push(child); return child;
}
async function waitFor(url) {
  for(let n=0;n<120;n++) { try { const response=await fetch(url); if(response.ok)return; } catch {} await new Promise(resolve=>setTimeout(resolve,250)); }
  throw new Error(`Local test server did not start: ${url}`);
}
try {
  for(const port of [3000,54329]) {
    try { await fetch(`http://127.0.0.1:${port}`); throw new Error(`Port ${port} is already occupied; stop that server before this isolated run.`); }
    catch(error) { if(!String(error).includes("fetch failed")) throw error; }
  }
  start(process.execPath,["tests/fixtures/local-services.mjs"],{},"services.log");
  await waitFor("http://127.0.0.1:54329/__test/state");
  const env={
    NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54329",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"synthetic-publishable-key",
    OPENAI_API_KEY:"synthetic-test-key",OPENAI_MODEL:"synthetic-model",OPENAI_BASE_URL:"http://127.0.0.1:54329/openai/v1",
    TAVILY_API_KEY:"synthetic-test-key",LOCAL_SERVICE_DOUBLE:"1",
    NODE_OPTIONS:`--import=${pathToFileURL(path.resolve("tests/fixtures/provider-preload.mjs")).href}`,
  };
  if (mode === "production") {
    const build=start("npm",["run","build"],{...env,NODE_ENV:"production"},"build.log");
    const code=await new Promise((resolve,reject)=>{build.once("exit",resolve);build.once("error",reject);});
    if (code !== 0) throw new Error(`Production build failed; inspect ${path.join(artifacts,"build.log")}`);
  }
  // Retain the log filename used by provider-diagnostic regression assertions.
  start("npm",["run",mode === "production" ? "start" : "dev","--","--hostname","127.0.0.1"],{...env,NODE_ENV:mode},"development.log");
  await waitFor("http://127.0.0.1:3000/login");
  const tests=spawn("npx",["playwright","test","--config","playwright.final.config.ts",...process.argv.slice(2)],{stdio:"inherit",env:process.env});
  const code=await new Promise((resolve,reject)=>{tests.on("exit",resolve);tests.on("error",reject);});
  process.exitCode=code ?? 1;
} catch(error) {
  console.error(error.message);process.exitCode=1;
} finally {
  try {
    const state=await (await fetch("http://127.0.0.1:54329/__test/state")).json();
    const summary={
      environment:"local in-memory service double; not Supabase PostgreSQL",
      applicationMode:mode,
      lastScenarioRecordIds:Object.fromEntries(Object.entries(state.tables).map(([name,rows])=>[name,rows.map(row=>({id:row.id,owner_id:row.owner_id||row.user_id}))])),
      createdSyntheticRecords:(await (await fetch("http://127.0.0.1:54329/__test/audit")).json()).records,
      liveRecordsCreatedByThisRun:0,
      note:"All isolated records cease to exist when this process stops; no real database was mutated.",
    };
    fs.writeFileSync(path.join(artifacts,"service-summary.json"),JSON.stringify(summary,null,2));
  } catch {}
  for(const child of children.reverse()) {try {process.kill(-child.pid,"SIGTERM");} catch {}}
}
