"use client";
// Synthetic visual fixture. scripts/verify-ui.mjs creates and removes its temporary local route.
import { DashboardOverview } from "@/components/dashboard/overview";
import { useState } from "react";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { DiscoverWorkspace } from "@/components/discover/discover-workspace";
import { QualificationWorkspace } from "@/components/qualification/workspace";
import { OutreachStudio } from "@/components/outreach/studio";
const companies = [{id:"019abbaa-1111-7111-8111-aaaaaaaaaaaa",name:"Evergreen Consulting",website:"https://example.com"}];
const contacts = [{id:"019abbaa-2222-7222-8222-aaaaaaaaaaaa",company_id:companies[0].id,full_name:"Alex Morgan",job_title:"Operations Director",verification_source:"https://example.com/team"}];
export default function Preview() {
 const [view,setView] = useState("profile");
 return <><div className="fixed bottom-2 right-2 z-50 flex gap-1 rounded-lg bg-white p-2 shadow" aria-label="Preview controls">{["dashboard","profile","discover","qualification","outreach"].map(v=><button className="px-1 text-xs" key={v} onClick={()=>setView(v)}>{v}</button>)}</div>{view === "dashboard" ? <DashboardOverview metrics={[{label:"Companies",value:"12"},{label:"Contacts",value:"8"},{label:"Qualified Leads",value:"4"},{label:"Outreach Drafts",value:"3"}]} hasError={false}/> : view === "profile" ? <ProfileEditor initial={{display_name:"Alex Morgan",headline:"B2B website consultant",linkedin_url:"",portfolio_url:"https://example.com",summary:"I build clear, accessible websites for professional service businesses.",raw_profile_text:"I help consulting teams improve their websites with React and TypeScript.",skills:["React","TypeScript"],services:["Website development"]}} initialAnalysis={null} lastAnalyzedAt={null}/> : view === "discover" ? <DiscoverWorkspace/> : view === "qualification" ? <QualificationWorkspace companies={companies}/> : <OutreachStudio companies={companies} contacts={contacts}/>}</>;
}
