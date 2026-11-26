# ProspectDesk AI

ProspectDesk AI helps freelancers, agencies, and consultants discover B2B prospects, research companies, qualify leads, and prepare personalized outreach.
Scout, its AI assistant, analyzes profiles and research to draft LinkedIn messages and emails. Users review, approve, and manually send every message.

## Features

- **Scout Profile Analyzer:** save your professional profile and get AI positioning and service recommendations.
- **Company discovery:** search with Tavily, research businesses, review sources, and save companies with duplicate detection.
- **Lead intelligence:** research decision-maker sources, save contact candidates, and score company fit with supporting evidence.
- **Outreach Studio:** generate and edit LinkedIn/email drafts, review, approve or reject them, and track manual sending. Follow-ups require a previously manually-sent message.
- **Saved records:** searchable, filtered, paginated lists of companies, contacts, qualified leads, and drafts.
- **Dashboard and authentication:** real Supabase-backed metrics, user-scoped data, and a responsive interface.

**No automatic sending.** Contact candidates and AI assessments require human verification.

## Stack

| Layer | Technologies |
| --- | --- |
| Application | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS, Lucide React |
| Data and authentication | Supabase Auth, PostgreSQL, Row-Level Security |
| AI and research | OpenAI API, Tavily API, Zod validation |
| Testing | Vitest, Playwright |

## Run locally

**Requirements:** Node.js 22.12+ (22.x) or 24+, npm, a configured Supabase database, and OpenAI/Tavily API keys.

```bash
git clone https://github.com/jisan3s/prospectdesk-ai.git
cd prospectdesk-ai
npm ci
cp .env.example .env.local
```

Fill in `.env.local` using your own credentials:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase client key |
| `OPENAI_API_KEY` | Server-only OpenAI key |
| `TAVILY_API_KEY` | Server-only research key |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini` |

### Database and authentication

**A fresh database cannot be provisioned from this repository alone.** Obtain the original Stage 2–7 schema, quota functions, and workflow triggers from the maintainer. The two ordered [security migrations](supabase/migrations/) are additive overlays, not the base schema.

Review and test migrations on staging before deployment; missing security RPCs cause affected operations to fail closed. They were installed on the configured hosted project on 25 November 2026—do not blindly rerun them there. Use [security-audit.sql](supabase/security-audit.sql) for read-only deployment checks.

Enable Supabase email/password authentication and configure the local site URL as `http://localhost:3000`. If email confirmation is enabled, use this confirmation link in the email template:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Then start the application:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Sign in or register through `/login`.

## Development and testing

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type checking |
| `RUN_RLS_TESTS=0 npx vitest run` | Offline unit and validation tests |

For browser workflows with local service doubles, free ports **3000 and 54329**, then run:

```bash
npx playwright install chromium
FINAL_REVIEW_ARTIFACT_DIR=artifacts/saved-records node scripts/run-final-review.mjs
```

The runner starts and stops its own servers without changing hosted records or making paid provider calls. Live RLS tests require a separate non-production database and two dedicated accounts; mock tests do not certify deployed RLS or live AI quality.

**Latest checks (26 November 2026):** lint and TypeScript passed; 63 unit tests passed, one live RLS test skipped; 46 browser tests and 19 isolated PostgreSQL security checks passed. The production build was blocked by this environment's Turbopack port-binding restriction; confirm a successful build before deployment.

## Security and costs

Authentication, ownership checks, RLS overlays, request limits, quotas, structured AI validation, and human approval support the application’s safeguards; they are not a complete security audit. Keep real `.env*` files and private backups out of Git. Never expose provider or service-role keys in browser code.

OpenAI and Tavily usage may incur charges. Use mocks for routine testing and configure provider-side budgets.

## Project layout

- `src/app/` — pages, authentication actions, and server API routes.
- `src/components/` — shared UI and feature workspaces.
- `src/lib/` — Scout, research, validation, security, and Supabase utilities.
- `supabase/` — additive security migrations and audit queries.
- `tests/` and `scripts/` — automated checks and local verification tools.

More detail: [saved-record pages](docs/saved-records.md) · [UI design and screenshots](docs/ui-modernization.md) · [historical codebase audit](docs/codebase-audit.md).

Before deployment, follow the [launch and recovery checklist](docs/launch.md). GitHub Actions now defines production build/browser checks with local service doubles; a workflow definition alone is not a passing run or a deployed application.

## Author and license

**[Jisan — Full-Stack Web Developer](https://github.com/jisan3s)**

No project license has been specified.
