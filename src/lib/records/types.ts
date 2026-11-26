export type RecordKind = "companies" | "contacts" | "leads" | "drafts";
export type SavedRecord = {
  id: string;
  title: string;
  company: string;
  companyId: string;
  date: string;
  status: string;
  subtitle: string;
  description: string;
  links: { label: string; url: string }[];
  score?: number;
  channel?: string;
  messageType?: string;
  confidence?: string;
  details: { label: string; text: string }[];
};

export const recordViews = {
  companies: { title: "Saved companies", description: "Your saved businesses, research summaries, and supporting sources.", action: "Discover companies", href: "/discover" },
  contacts: { title: "Saved contacts", description: "Contact candidates linked to your companies. Review the source and current role before outreach.", action: "Find decision-makers", href: "/qualification#decision-makers" },
  leads: { title: "Qualified leads", description: "Companies whose latest saved Scout assessment scores 70 or higher. Scores are AI assessments, not verified facts.", action: "Score a company", href: "/qualification" },
  drafts: { title: "Saved outreach drafts", description: "All saved messages, including drafts, reviews, approvals, rejections, and manually sent records. Approval never sends a message.", action: "Open Outreach Studio", href: "/outreach" },
} satisfies Record<RecordKind, { title: string; description: string; action: string; href: string }>;
