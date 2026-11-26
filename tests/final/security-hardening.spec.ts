import { test, expect } from "@playwright/test";
const services="http://127.0.0.1:54329";
const id="019abbaa-1111-7111-8111-aaaaaaaaaaaa";
test.beforeEach(async ({page,request})=>{
  await request.post(`${services}/__test/reset`);
  await page.route("**/*",r=>["localhost","127.0.0.1"].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.goto("/login");await page.getByLabel("Email",{exact:true}).fill("e2e-a@example.test");await page.getByLabel("Password",{exact:true}).fill("E2E-password-123");
  await page.getByRole("button",{name:"Sign In",exact:true}).click();await expect(page).toHaveURL("http://127.0.0.1:3000/");
});
test("every data write rejects oversized bodies and incorrect MIME types",async({page,request})=>{
  const session=await(await request.post(`${services}/auth/v1/token`,{data:{email:"e2e-a@example.test",password:"E2E-password-123"}})).json();
  const headers={authorization:`Bearer ${session.access_token}`};
  await request.post(`${services}/rest/v1/companies`,{headers,data:{id,name:"Test Company"}});
  await request.post(`${services}/rest/v1/outreach_drafts`,{headers,data:{id,company_id:id,channel:"email",message_type:"initial",subject:"Test",body:"Test message",status:"draft"}});
  for(const [method,url] of [
    ["POST","/api/companies"],["POST","/api/profile"],["POST","/api/profile/analyze"],
    ["POST","/api/discover/search"],["POST","/api/discover/research"],["POST","/api/discover/save"],
    ["POST","/api/qualification/score"],["POST","/api/qualification/decision-makers"],["POST","/api/qualification/contacts"],
    ["POST","/api/outreach/generate"],["PATCH",`/api/outreach/drafts/${id}`],
  ]) {
    const headers={"content-type":"application/json"};
    const response=await page.request.fetch(url,{method,headers,data:JSON.stringify({text:"x".repeat(70000)})});
    expect(response.status(),url).toBe(413);
    const mime=await page.request.fetch(url,{method,headers:{"content-type":"application/json-evil"},data:"{}"});
    expect(mime.status(),url).toBe(415);
  }
});
test("all six costly operations fail closed on the independent security rate guard",async({page,request})=>{
  const profile={display_name:"Test",headline:"Web development consultant",linkedin_url:"",portfolio_url:"",summary:"Website development for professional services with TypeScript.",raw_profile_text:"Experienced web developer",skills:["TypeScript"],services:["Website development"]};
  await expect(await page.request.post("/api/profile",{data:profile})).toBeOK();
  const report=await(await page.request.post("/api/discover/research",{data:{name:"Sample Company",website:"https://example.com",industry:"Consulting",location:"Texas"}})).json();
  const saved=await(await page.request.post("/api/discover/save",{data:{company:report.company,research:report.research,sources:report.sources}})).json();
  const cases=[
    {url:"/api/profile/analyze"},
    {url:"/api/discover/search",data:{industry:"Consulting",location:"Texas"}},
    {url:"/api/discover/research",data:{name:"Sample Company",website:"https://example.com",industry:"Consulting",location:"Texas"}},
    {url:"/api/qualification/score",data:{companyId:saved.companyId}},
    {url:"/api/qualification/decision-makers",data:{companyId:saved.companyId}},
    {url:"/api/outreach/generate",data:{companyId:saved.companyId,contactId:null,channel:"email",messageType:"initial",angle:""}},
  ];
  const state=async()=>(await request.get(`${services}/__test/state`)).json();
  const providerCount=async()=>(await state()).requests.filter((r:{path:string})=>r.path.startsWith("/openai/")||r.path==="/tavily/search").length;
  const before=await providerCount();
  for(const unavailable of [false,true]) {
    await request.post(`${services}/__test/faults`,{data:{securityDenied:!unavailable,securityUnavailable:unavailable}});
    for(const row of cases)expect((await page.request.post(row.url,row.data?{data:row.data}:{})).status(),row.url).toBe(unavailable?503:429);
  }
  expect(await providerCount()).toBe(before);
});
test("security headers are present without breaking login and navigation",async({page})=>{
  const response=await page.goto("/companies");
  const headers=response!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  await expect(page.getByRole("heading",{name:"Saved companies",exact:true})).toBeVisible();
});
test("record search/page bounds are enforced on the server and no full dataset is downloaded",async({page,request})=>{
  const before=(await(await request.get(`${services}/__test/state`)).json()).requests.length;
  await page.goto("/companies?search="+"x".repeat(201));
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid record filters");
  await page.goto("/companies?page=100001");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid record filters");
  await page.goto("/companies");await expect(page.getByText("0 records",{exact:true})).toBeVisible();
  const state=await(await request.get(`${services}/__test/state`)).json();
  expect(state.requests.some((r:{path:string})=>r.path==="/rest/v1/rpc/list_saved_records")).toBe(true);
  expect(state.requests.slice(before).filter((r:{path:string})=>r.path==="/rest/v1/companies")).toHaveLength(0);
});
