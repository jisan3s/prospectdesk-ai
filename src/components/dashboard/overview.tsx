import Link from "next/link";
import { ArrowRight, Sparkles, Building2, Users, Target, MessageSquare } from "lucide-react";
import { Alert, Badge, PageHeading } from "@/components/ui/primitives";

const metricDetails = {
  Companies: { icon: Building2, href: "/companies", description: "Saved to your workspace" },
  Contacts: { icon: Users, href: "/contacts", description: "Recorded contact candidates" },
  "Qualified Leads": { icon: Target, href: "/leads", description: "Latest company score ≥ 70" },
  "Outreach Drafts": { icon: MessageSquare, href: "/drafts", description: "Drafts awaiting completion" },
};

export type DashboardMetric = { label: keyof typeof metricDetails; value: string };

export function DashboardOverview({ metrics, hasError }: { metrics: DashboardMetric[]; hasError: boolean }) {
  return (
    <main className="workspace space-y-8">
      <PageHeading eyebrow="Your prospecting workspace" title="A little research. A lot of possibility." description="Welcome to ProspectDesk AI. Keep your pipeline moving with focused research, relevant leads, and thoughtful outreach."><Link href="/discover" className="button-primary">Discover companies <ArrowRight size={16} aria-hidden="true"/></Link></PageHeading>
      {hasError && <Alert>Some activity counts could not be loaded. Refresh the page to try again.</Alert>}
      <section aria-label="Prospecting metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value }) => { const { icon: Icon, href, description } = metricDetails[label]; return (
          <Link href={href} key={label} className="panel group transition-colors hover:border-indigo-300">
            <div className="flex items-center justify-between"><span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Icon size={20} aria-hidden="true"/></span><ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-600" aria-hidden="true"/></div>
            <p className="mt-5 text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-3 text-xs text-slate-500">{description}</p>
          </Link>
        ); })}
      </section>
      <section className="panel flex flex-col justify-between gap-6 border-teal-100 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Sparkles size={24} aria-hidden="true"/></span><div><Badge tone="scout">Meet your research partner</Badge><h2 className="mt-3 text-xl font-semibold tracking-tight">Put Scout to work for you.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">A strong profile helps Scout connect your expertise to the right companies. Start with your skills, services, and experience.</p></div></div><Link href="/profile" className="button-secondary shrink-0">Open Scout Profile <ArrowRight size={16} aria-hidden="true"/></Link>
      </section>
      <section><div className="mb-5"><h2 className="text-lg font-semibold tracking-tight">Your next steps</h2><p className="mt-1 text-sm text-slate-500">From a promising company to a personal introduction.</p></div><div className="grid gap-4 md:grid-cols-3">{[
        { href: "/discover", step: "01", title: "Discover & research", text: "Explore an industry, check company sources, and save the evidence." },
        { href: "/qualification", step: "02", title: "Qualify your leads", text: "Understand fit, review scoring signals, and identify possible buyers." },
        { href: "/outreach", step: "03", title: "Make it personal", text: "Create a grounded draft, review every claim, and approve it for manual outreach." },
      ].map(item => <Link href={item.href} key={item.href} className="panel group hover:border-indigo-300"><span className="text-xs font-semibold tracking-widest text-indigo-600">{item.step}</span><h3 className="mt-4 text-base font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p><ArrowRight size={17} className="mt-5 text-slate-400 group-hover:text-indigo-600" aria-hidden="true"/></Link>)}</div></section>
    </main>
  );
}
