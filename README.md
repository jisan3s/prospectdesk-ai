# ProspectDesk AI — Stage 7 Security, Testing & Evaluation

**Additive security/test package for the Stage 1–6 code developed in this conversation.** You must apply the small guarded-route edits below for the new safeguards to take effect. This package does not replace your dashboard, auth client, profile analyzer, discovery, scoring, or outreach implementations.

## 1. Dependencies

```bash
npm install -D @playwright/test tsx
npx playwright install chromium
```

Keep your working Vitest version (if `vitest@5` conflicts with your `@types/node`, don't force-install it). Existing SDKs: `openai`, `@supabase/supabase-js`, `zod`.

## 2. SQL migration

Review and run `supabase/migrations/202611230003_stage7_request_limits.sql` once in your existing Supabase SQL Editor. It creates a user-owned hourly quota ledger and an authenticated RPC without altering old data. Confirm `claim_api_hourly_limit` exists afterward. **Do not rerun Stages 2–6 migrations.**

## 3. Integrate the guard into the six expensive POST routes

Add these imports to each route:

```ts
import { validateWriteRequest, enforceHourlyQuota } from "@/lib/security/request-guard";
import { readBoundedJson } from "@/lib/security/safe-json";
```

At the very beginning of `POST(request: Request)`, add:

```ts
const rejected = validateWriteRequest(request);
if (rejected) return rejected;
```

Keep each existing `supabase.auth.getUser()` verification. **Immediately after successful authentication, before any external provider call or existing daily quota claim**, add the hourly quota check:

```ts
const limited = await enforceHourlyQuota(supabase, "outreach_generate");
if (limited) return limited;
```

Choose the correct literal action for each route:

| Existing file | Action |
| --- | --- |
| `src/app/api/profile/analyze/route.ts` | `profile_analyze` |
| `src/app/api/discover/search/route.ts` | `company_search` |
| `src/app/api/discover/research/route.ts` | `company_research` |
| `src/app/api/qualification/score/route.ts` | `lead_score` |
| `src/app/api/qualification/decision-makers/route.ts` | `decision_search` |
| `src/app/api/outreach/generate/route.ts` | `outreach_generate` |

For each POST endpoint accepting a JSON body, replace the call `await request.json()` with `await readBoundedJson(request)` inside its current `try/catch` or `safeParse` handling. The helper rejects bodies >16 KB even if Content-Length is absent. Note: `profile/analyze` has no request body and should **not** use the JSON content-type/body guard; only add the hourly quota check after authentication to that route. Other routes that don't accept a body should likewise skip `validateWriteRequest` and `readBoundedJson`. For these six target routes, only `profile/analyze` has no JSON body in our implementation.

**IMPORTANT:** Do not insert the guard before auth claims are checked; the quota RPC uses `auth.uid()` and will reject anonymous calls. This quota is additive to earlier daily limits, and can return 429 earlier than the daily ceiling.

## 4. Offline unit/evaluation tests (no provider charges)

```bash
npx vitest run src/lib/security tests/evals tests/unit
```

These test schema contracts, a bounded JSON body reader, and known dangerous phrases in synthetic adversarial cases. They do **not** prove that the model is safe or accurate.

## 5. Optional live model evaluation (uses OpenAI credits)

```bash
RUN_LIVE_EVALS=1 npx tsx scripts/run-live-evals.ts
```

Run only when you choose to spend API credits. It runs two synthetic adversarial prompts; inspect the results manually. The prompts use fictional companies and no user data. Review failure cases and improve prompts/validators before shipping.

## 6. Unauthenticated HTTP smoke tests

Start the Next.js dev server in a separate terminal:

```bash
npm run dev
```

Run:

```bash
npx playwright test --config=playwright.stage7.config.ts
```

Expected: unauthenticated `/` redirects to `/login`, and protected API POSTs return 401. Do this in a clean browser context (Playwright uses one by default).

## 7. Real cross-user RLS integration test (dedicated TEST project only)

**Do not run against production.** Create two normal confirmed test accounts in a separate Supabase project with Stages 2–7 migrations applied. Do not use service-role keys. In a local ignored file `.env.stage7.test.local`, set:

```dotenv
TEST_SUPABASE_URL=https://YOUR_TEST_PROJECT.supabase.co
TEST_SUPABASE_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_KEY
TEST_USER_A_EMAIL=TEST_A_EMAIL
TEST_USER_A_PASSWORD=TEST_A_PASSWORD
TEST_USER_B_EMAIL=TEST_B_EMAIL
TEST_USER_B_PASSWORD=TEST_B_PASSWORD
RUN_RLS_TESTS=1
```

Verify that `.env.stage7.test.local` is in `.gitignore`. Then load its variables in the current shell and execute:

```bash
set -a
source .env.stage7.test.local
set +a
npx vitest run tests/integration/rls.integration.test.ts
```

The test creates one synthetic company under A and checks B cannot read/update/delete it or forge `owner_id`. Afterward it attempts to delete only the exact test-created company. The test intentionally skips unless `RUN_RLS_TESTS=1`.

## 8. Manual high-priority security scenarios

1. Use browser private mode: `/`, `/profile`, `/discover`, `/qualification`, `/outreach` redirect to login while logged out.
2. Delete a test user in Supabase Auth while their browser is active; verify protected pages/POST routes using `getUser()` reject them.
3. Test cross-user RLS for **every table**, not only companies: `profiles`, `contacts`, `research_sources`, `lead_scores`, `outreach_drafts`, `agent_runs`.
4. Submit invalid JSON, huge body, wrong `Content-Type`, and cross-site `Origin` to API routes; confirm 4xx and no external API call.
5. Run 429 tests for hourly quotas and existing daily quotas, including concurrent requests. Keep provider budgets low.
6. Confirm only approved drafts can transition to `manually_sent`. Direct Supabase attempts to alter approved/sent content must fail (Stage 6 trigger).
7. Try prompt injections inside profile text, Tavily snippets, and user-provided personalization; Scout must treat them as data and avoid invented claims.
8. Test OpenAI 429/timeouts/bad credentials and Tavily 429/outage scenarios; give a safe error, preserve database integrity, avoid duplicate payments where possible.
9. Verify `.env.local` and test credentials are ignored by Git, and no secrets appear in client bundles or logs.
10. Manually review at least 20 lead scores and 20 messages. Track unsupported claims, factual errors, source coverage, and tone.

## 9. Build checks

```bash
npx tsc --noEmit
npm run lint
npm run build
git status
```

## 10. Launch blockers requiring further engineering

This package is a **security baseline**, not a certification that the SaaS is production-secure.

- Stage 4's `/api/discover/save` trusts client-submitted research snapshots. A signed-in user can edit their own research before saving. For audit-grade attribution, change Stage 4 to save immutable server-originated research results and accept only a snapshot ID from the browser.
- Stage 2 RLS allows owner-controlled updates to several tables; any fields requiring immutable provenance need tighter column grants or database triggers. Test all tables with two accounts.
- Limit endpoints per-IP/account at your edge or hosting provider **before** auth to reduce signup/API abuse; database per-user quotas cannot stop unlimited new accounts.
- Add production monitoring for API errors, cost per request, rate limits, and failed policy checks, without logging personal data or API keys.
- Establish privacy retention, prospect deletion, opt-out, and appropriate lawful basis before real campaigns. LinkedIn messages remain manual.
- Run a security review and production smoke tests after deployment before making real client data available to users.

## Troubleshooting

| Symptom | Cause/next step |
| --- | --- |
| `503 Usage safeguard unavailable` | Check Stage 7 SQL migration, RPC signature and execute grant |
| `429 Hourly request limit reached` | Quota exhausted, wait for next UTC hour; don't bypass safeguards |
| `415 Expected application/json` | Send JSON content type to body-bearing endpoints |
| `413 Request too large` | Reduce input size; check `readBoundedJson` integration |
| RLS test sign-in failure | Confirm test accounts and email confirmation in the **test** project |
| Playwright browser missing | Run `npx playwright install chromium` |
| Unit test module import error | Confirm Stage 1–6 files are merged and tsconfig `@/*` paths work |
| Build fails with Cache Components | Keep existing `connection()` + `Suspense`; don't add `dynamic = "force-dynamic"` |
