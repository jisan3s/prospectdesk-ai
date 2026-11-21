
import {
  Bot,
  Building2,
  Users,
  Target,
  MessageSquare,
  ScanSearch,
} from "lucide-react";

const metrics = [
  { label: "Companies", value: "0", icon: Building2 },
  { label: "Contacts", value: "0", icon: Users },
  { label: "Qualified Leads", value: "0", icon: Target },
  { label: "Outreach Drafts", value: "0", icon: MessageSquare },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10 flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-3 text-white">
            <ScanSearch size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              ProspectDesk AI
            </h1>
            <p className="text-sm text-slate-500">
              Client Prospecting Workspace
            </p>
          </div>
        </header>

        <section className="mb-8">
          <h2 className="text-3xl font-bold">
            Welcome to your workspace
          </h2>
          <p className="mt-2 text-slate-600">
            Find potential clients and prepare personalized outreach.
          </p>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <article
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <Icon className="mb-4 text-slate-500" size={22} />
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-bold">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <Bot className="text-indigo-600" size={28} />
            <div>
              <h2 className="text-xl font-semibold">
                Meet Scout
              </h2>
              <p className="text-sm text-slate-500">
                Your AI prospecting assistant
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-5">
            <p className="text-slate-700">
              Scout will help you research companies,
              qualify leads, and draft personalized messages.
            </p>
            <p className="mt-3 text-sm text-amber-700">
              AI features are not connected yet.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
