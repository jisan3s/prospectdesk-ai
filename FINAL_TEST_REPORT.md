# ProspectDesk AI — Final Application Test Report

Review date: **23 November 2026 (Asia/Dhaka)**. Scope: the existing Stage 1–7 application, its six page routes, authentication callback, twelve data API routes, and supporting validation/security code.

## A. Executive summary

**Readiness: Not ready for Stage 8 until database and live authentication verification are completed.** The application passes the local automated checks and isolated browser workflows described below. This assessment reflects missing authoritative database evidence and safe live-test access; it is not a claim that the deployed database is broken.

- **6/6 implemented application pages** visited and interacted with using actual Next.js URLs. The confirmation callback and framework not-found page were also exercised.
- **28 functional/API scenario groups + 6 responsive/accessibility scenarios = 34 isolated Playwright tests passed**, zero failures, skips, flaky results, or retries in the final run (123.28 seconds).
- **11 existing signed-out Playwright tests passed** against the production server (3.6 seconds).
- **56 Vitest tests passed; 1 live RLS test skipped**. Lint, TypeScript, and the production build passed.
- **12 reproduced issue groups fixed**, including browser writes rejected on loopback, an unguarded company-write origin, duplicate search submission, loss of unsaved draft edits, and mobile navigation disappearing during streamed loading.
- **25 final screenshots** captured at 375, 768, 1024, and 1440 pixels.
- **No real accounts created, customer data modified, paid AI/search requests made, or external outreach sent.** No migrations, environment files, dependencies, or production data were deleted.

### Evidence boundaries and test environment

The original `.env.local` points to a hosted Supabase project whose development/production status could not be established. No approved dedicated test credentials were available; the separate Stage 7 test environment file contained no configured values. The real project was used only for signed-out page/API checks and the normal build.

Authenticated tests instead started the **actual Next.js development application**, its actual server-rendered pages and Route Handlers, and the installed Supabase/OpenAI SDKs against local HTTP service doubles. Those doubles implement the portions of Auth, PostgREST, quota RPCs, OpenAI, and Tavily required by the scenarios. They use synthetic credentials and in-memory records. This is broader than intercepting component responses, but it does **not** execute PostgreSQL policies, SQL functions, triggers, real JWT verification, or provider inference.

The runner overrides credentials and URLs in its child process, redirects Tavily locally, blocks known real provider/Supabase destinations, and stops its own processes. It never rewrites `.env.local`. Browser requests outside loopback are blocked in the isolated scenarios. All test servers were stopped after verification.

## B. Page-by-page results and route inventory

“Pass (isolated)” means actual page/UI behavior backed by local service doubles. All five protected pages were also checked signed out against the production server. No page is counted as tested merely because it returned HTTP 200.

| Page | Purpose / authentication | Main interaction and expected behavior | Loads | UI | Functionality | Responsive | Status |
|---|---|---|---|---|---|---|---|
| `/` | Dashboard; authenticated | Owner-scoped company/contact counts, latest qualifying company scores, draft/in-review counts, shortcuts | Pass | Pass | Exact seeded counts and state changes verified | All four widths | Pass (isolated) |
| `/login` | Public login and registration mode | Required credentials, login, signup feedback, confirmation errors; successful login navigates home | Pass | Pass | Invalid inputs/login, synthetic signup, session and logout checked | All four widths | Pass; production signed-out checks also pass |
| `/profile` | Scout Profile Analyzer; authenticated | Edit/save profile; analyze; refresh without losing saved data; show failures | Pass | Pass | Save/edit/reload, analysis, validation and recovery | All four widths | Pass (isolated) |
| `/discover` | Company Discovery and Research; authenticated | Search, choose candidate, research sources, save once and identify duplicates | Pass | Pass | Search/research/save UI, evidence, duplicates, empty/failure/pending states | All four widths | Pass (isolated) |
| `/qualification` | Company selection, lead scoring, decision-maker research; authenticated | Score saved company, inspect evidence, research leadership, save contact candidate | Pass | Pass | Strong/weak assessments, source links, contacts, company-switch reset | All four widths | Pass (isolated) |
| `/outreach` | Outreach Studio; authenticated | Generate, edit, reload, review, reject/revise, approve, manually track sent, follow up | Pass | Pass | LinkedIn/email workflows, invalid transitions, conflicts and unsaved work | All four widths | Pass (isolated) |

There are no separate settings, company-detail, decision-maker, lead-scoring, or signup pages. Those capabilities are contained in the routes above where implemented.

Additional routes:

| Route | Purpose | Result |
|---|---|---|
| GET `/auth/confirm` | Supabase email confirmation callback | Invalid links show a safe error; successful synthetic OTP establishes a session; incoming browser host retained |
| Unknown URL | Framework not-found response | Actual not-found page rendered |

## C. Feature testing results

| Feature | Test scenario | Expected result | Actual result | Status |
|---|---|---|---|---|
| Authentication | Empty/malformed fields and invalid credentials | Reject without entering workspace | Native validation and safe feedback visible | Pass |
| Authentication | Synthetic login, refresh, logout | Session persists on reload; logout protects pages | Verified through browser and server-rendered pages | Pass (mock Auth) |
| Registration | Switch mode and submit synthetic account details | Show confirmation guidance | Feedback shown; no real user/email created | Pass (mock Auth) |
| Confirmation | Invalid link and synthetic valid OTP | Error or authenticated redirect on original host | Both paths verified | Pass (mock Auth) |
| Expired/revoked session | Revoke synthetic user/session and revisit | Redirect to login; APIs return 401 | Observed | Pass (simulated) |
| Profile | Save, reload, edit, analyze | Saved values restored; structured recommendations displayed | UI and backing service state agree | Pass (isolated) |
| Profile | Invalid input, delayed save and provider failure | No invalid write; prevent duplicate submission; recover | Validation, disabled controls and terminating pending state verified | Pass |
| Discovery | Search and select candidate | Selection fills candidate without another search | Search request count remains one | Pass |
| Discovery | Research, inspect source, save, reload, duplicate | Evidence persists; same company is not saved twice | UI and API duplicate behavior verified | Pass (isolated) |
| Discovery | Empty results, rate limit and provider failure | Clear feedback and usable retry | Empty/error states and recovery verified | Pass |
| Research integrity | Empty evidence, wrong source domain, invalid indexes/AI | Reject unsupported output without saving false research | 422/400/502 as applicable; no company write | Pass |
| Contacts | Leadership search, source selection, save and reload | Candidate linked to selected company and source | Stored association checked; candidate is not portrayed as independently verified | Pass (isolated) |
| Contacts | Change selected company | Clear old contact details and research context | Name/title/source/LinkedIn cleared | Pass |
| Lead scoring | Strong and weak fit, malformed provider output | Existing categories/thresholds; reject invalid output | Structured scores displayed; malformed result rejected | Pass (fixtures) |
| Lead scoring | Insufficient research evidence | Do not persist an unsupported assessment | Empty-evidence rejection exercised; live evidence quality not assessed | Partial: validation tested |
| Dashboard | Save company/contact, score, review/approve/send draft | Original four metrics reflect real query results | Exact local-service counts match UI across transitions | Pass (isolated) |
| LinkedIn outreach | Generate, edit, reload, review | Draft state initially; enforce length and save revision | Browser workflow and oversized edit rejection verified | Pass |
| Email outreach | Generate subject/body, edit, save and reload | Saved subject/body retained | Verified through actual UI/API | Pass |
| Review workflow | Submit, reject, revise, approve, manually sent | Only allowed transitions; explicit manual-send confirmation | Valid paths work; invalid states/conflicts rejected | Pass |
| Follow-ups | Generate before/after eligible manually sent message | Reject ineligible parent; permit eligible follow-up | Both paths exercised | Pass |
| Unsaved drafts | Click current draft, change selection, generate | Preserve current edits; confirm before discard | Canceled actions retain edits and avoid generation | Pass |
| Ownership | User B accesses user A company/draft | No exposure or mutation; explicit owner filter | Empty list/404 and owner-filter assertion verified | Pass at application/mock layer |
| Usage guards | Exhausted/unavailable quota on all six costly actions | Fail closed before provider call | 429/503; provider request count unchanged | Pass at application/mock layer |
| Reliability | Database/provider errors and malformed JSON | Useful safe errors; controls recover | Exercised in API and UI paths | Pass for listed scenarios |
| Manual outreach | Approve and mark manually sent | Record user action without transmitting a message | Status transitions and explicit no-transmission feedback verified | Pass |

Scenarios combine UI interactions, API assertions and backing-service inspection. Not every validation boundary or error permutation was tested on every endpoint. Fake successful outputs establish integration behavior, not the factual accuracy of AI recommendations or contact information. A real network-timeout duration and real auth token-refresh lifecycle were not separately measured.

## D. Bugs discovered, fixes and retests

Severity describes observed impact in this checkout. Each listed fix has a passing regression check; no unrelated redesign or broad refactor was performed.

### B01 — Legitimate browser writes rejected on loopback (high)

- **Reproduce:** Sign in at `http://127.0.0.1:3000` and save a profile. The request returned 403.
- **Root cause:** Next.js reconstructed `request.url` using `localhost`; direct Origin-to-URL comparison rejected the browser's actual authority.
- **Files:** `src/lib/security/same-origin.ts`, `src/lib/security/request-guard.ts`, profile/discovery/qualification write handlers and outreach draft PATCH.
- **Fix:** Shared comparison uses incoming Host with the URL's scheme, does not trust a forwarded-host override, and retains support for authenticated API clients without Origin.
- **Retest:** Legitimate actual-browser writes pass; mismatched scheme/authority, foreign Origin and forwarded-host spoof cases fail. Three unit tests added.

### B02 — Basic company POST omitted browser-origin checking (high)

- **Reproduce:** Authenticated POST `/api/companies` with a foreign Origin created a synthetic company (201).
- **Root cause:** This write handler lacked the origin check already present on other feature writes.
- **File:** `src/app/api/companies/route.ts`.
- **Fix:** Apply shared origin guard before processing writes.
- **Retest:** Foreign Origin returns 403 and creates no record; normal company creation still works.

### B03 — Choosing a candidate repeated company search (medium)

- **Reproduce:** Search and click “Use as candidate”; provider search count changed from one to two.
- **Root cause:** A button inside the search form defaulted to submit.
- **File:** `src/components/discover/discover-workspace.tsx`.
- **Fix:** Explicit `type="button"`.
- **Retest:** Selecting a candidate fills the form without another request. No paid calls were used to reproduce it.

### B04 — Previous company's contact details remained selected (medium)

- **Reproduce:** Fill contact name/title/source/LinkedIn for company A, then choose company B.
- **Root cause:** Selection cleared assessment/search results but retained editable contact state.
- **File:** `src/components/qualification/workspace.tsx`.
- **Fix:** Clear contact fields and feedback in the selection event.
- **Retest:** All prior company contact fields clear; new candidate saving remains functional.

### B05 — Invalid confirmation links had no explanation (medium)

- **Reproduce:** Open invalid `/auth/confirm`; login rendered without actionable confirmation feedback.
- **Root cause:** Callback error query was not read by the login UI.
- **File:** `src/app/login/page.tsx`.
- **Fix:** Read the recognized confirmation error with `useSearchParams` under Suspense and display constant, safe guidance.
- **Retest:** Alert visible; normal login/signup and production build pass.

### B06 — Confirmation redirect changed browser hostname (medium)

- **Reproduce:** Visit confirmation callback on 127.0.0.1; redirect used localhost.
- **Root cause:** Redirect target inherited the framework's normalized authority.
- **File:** `src/app/auth/confirm/route.ts`.
- **Fix:** Preserve incoming Host for callback navigation; existing Supabase OTP verification remains intact.
- **Retest:** Successful synthetic OTP and failure redirects retain the incoming host; authenticated reload works.

### B07 — Draft selection discarded unsaved work (medium)

- **Reproduce:** Edit a draft body, then click the currently selected draft or choose another/generate a new draft.
- **Root cause:** Selection/generation replaced editor state without guarding unsaved edits.
- **File:** `src/components/outreach/studio.tsx`.
- **Fix:** Current selection is a no-op; changing drafts or generating asks native discard confirmation when edited.
- **Retest:** Current click and canceled discard preserve edits; canceled generation makes no provider request; saved review workflow passes.

### B08 — Database outages reported as missing records (medium)

- **Reproduce:** Simulate a company/draft read failure during contact saving, leadership research, or draft editing.
- **Root cause:** Lookup error and absent row shared a 404 response branch.
- **Files:** `src/app/api/qualification/contacts/route.ts`, `src/app/api/qualification/decision-makers/route.ts`, `src/app/api/outreach/drafts/[id]/route.ts`.
- **Fix:** Return safe 500 for lookup errors and retain 404 for absent/foreign records.
- **Retest:** All three failure cases return 500; absent/cross-user cases still return 404.

### B09 — Default Vitest command collected Playwright specs (medium)

- **Reproduce:** Run plain `npx vitest run`; two Playwright suites fail collection while unit tests pass.
- **Root cause:** No explicit Vitest discovery configuration separated browser `.spec.ts` files.
- **File:** `vitest.config.mts`.
- **Fix:** Discover `.test.ts` files under source/tests and configure the existing source alias; ESM extension avoids the Vite loader warning.
- **Retest:** Plain command passes 56 tests with only the opt-in live RLS test skipped.

### B10 — Sidebar helper text had inadequate contrast (low)

- **Reproduce:** Measure small slate-400 sidebar helper text against white: approximately 2.63:1.
- **Root cause:** Muted token too light for small text.
- **File:** `src/components/layout/app-shell.tsx`.
- **Fix:** Change the two helper paragraphs to slate-500, preserving the design.
- **Retest:** Measured approximately 4.76:1; responsive/navigation checks pass. This is not a whole-app contrast certification.

### B11 — Mobile menu disappeared when streamed content arrived (medium)

- **Reproduce:** Delay authenticated data, open the mobile menu while skeleton is visible, then let content resolve.
- **Root cause:** Separate AppShell instances in fallback and loaded content remounted navigation state.
- **Files:** All five protected `page.tsx` files, dashboard/workspace components, and legacy UI preview fixture.
- **Fix:** Render one persistent AppShell outside each page's Suspense boundary; keep authentication, data queries and server/client boundaries inside their existing content flow.
- **Retest:** Menu remains open after loading completes; focus/Escape behavior and all real pages pass. Signed-out routes still redirect; production build passes.

### B12 — Provider diagnostic detail entered application logs (medium)

- **Reproduce:** Simulate a scoring provider error containing a private diagnostic marker; marker appeared in application logs.
- **Root cause:** Catch path logged raw exception message. Related database/quota diagnostics also logged raw messages.
- **Files:** `src/app/api/qualification/score/route.ts`, `src/app/page.tsx`.
- **Fix:** Log error class or database error code instead of raw provider/database messages.
- **Retest:** Synthetic private marker absent from the scoring API response and new application-log segment; safe failure context remains available.

## E. API testing results

Automatically inventoried **12 data route files / 13 exported methods**, plus the confirmation callback. Every data method rejects an unauthenticated request with 401, and unsupported PUT returns 405 on all twelve data routes.

| Route | Methods | Successful / expected behavior exercised |
|---|---|---|
| `/api/companies` | GET, POST | Owned list/create; validation 400, foreign Origin 403, other-user empty list |
| `/api/profile` | POST | Save/edit; invalid JSON/fields or forged user ID 400, oversized input 413, proper browser Origin accepted |
| `/api/profile/analyze` | POST | Structured analysis; provider failure and quota denial/unavailability |
| `/api/discover/search` | POST | Results/empty results; invalid input 400, provider failure 502, quota 429/503 |
| `/api/discover/research` | POST | Structured sourced research; no evidence 422, invalid output 502, quota 429/503 |
| `/api/discover/save` | POST | Save company/evidence; duplicate 409; invalid indexes/source domain 400 |
| `/api/qualification/decision-makers` | POST | Leadership source candidates; invalid input 400, database 500, quota 429/503 |
| `/api/qualification/contacts` | POST | Save sourced contact candidate; invalid input 400, lookup error 500 |
| `/api/qualification/score` | POST | Persist valid assessment; invalid input 400, foreign company 404, provider 502, quota 429/503 |
| `/api/outreach/generate` | POST | LinkedIn/email/follow-up drafts; invalid input 400, Origin 403, size 413, content type 415, quota 429/503 |
| `/api/outreach/drafts` | GET | Owned persisted draft listing and reload |
| `/api/outreach/drafts/[id]` | PATCH | Save/review transitions; invalid input/manual confirmation 400, foreign row 404, stale/invalid transition 409, lookup failure 500 |
| `/auth/confirm` | GET | Valid synthetic OTP/session and invalid-link redirects |

Successful writes returned the handler's existing 200/201 contract. Unexpected baseline responses were reproduced and corrected as B01/B02/B08. Simulated provider/network errors were deliberate test inputs, not unexplained production failures. Request-size enforcement was tested on profile and outreach generation; it was **not** demonstrated uniformly across all routes.

## F. Database verification and test records

- Verified profile save/edit/reload; company + supporting-source save/reload and duplicate rejection; contact association; persisted scores; draft subject/body/status/revision reloads; follow-up eligibility; and dashboard metrics using the local in-memory service.
- IDs and ownership returned by the service were used in subsequent requests. Primary synthetic creation entries are recorded in [service-summary.json](artifacts/final/service-summary.json); this is an audit of the service double, not a complete SQL transaction/evidence-row audit.
- Dashboard assertions use the existing calculation: owner-scoped companies and contacts, each company's latest selected score with threshold **70**, and only `draft`/`in_review` outreach rows. No hardcoded demonstration metrics were added to production code.
- User B's queries include explicit ownership filters and cannot change user A's company/draft in these scenarios. This does not establish real database RLS correctness.
- No `supabase/migrations/` directory or authoritative policy/RPC/trigger definitions are present in this checkout. Database recreation, schema compatibility, grants, transaction atomicity, concurrent writes, unique indexes and trigger-managed revisions were **not verified**.
- **Real test records remaining: zero.** All isolated records vanished when the local service process stopped. Existing business records/profile were not mutated; no cleanup SQL was executed.

## G. Security findings

Verified locally: unauthenticated API/page rejection; explicit owner filters; mismatched-Origin rejection; Zod input and structured-output validation; profile/generation size failures; outreach content-type enforcement; quota denial before provider calls on all six costly actions; invalid source/index rejection; allowed outreach transitions; revision conflicts; manual-send confirmation; safe scoring error response/logging; and existing offline prompt/output safety tests.

Preserved: Supabase authentication clients/proxy, route protection, API schemas, model prompts, provider limits/timeouts, lead scoring methodology, quotas, human review, and manual sending. No email/LinkedIn sender was introduced.

Remaining security verification: real RLS, JWT/key rotation and refresh, SQL function privileges and quota atomicity, deployment proxy authority handling, and real concurrent updates. Body/streaming limits and hourly guard coverage remain uneven: outreach generation uses the shared bounded reader/hourly helper; the other costly routes retain their existing validation/daily guards. Uniform hardening is a follow-up, not a claim of full Stage 7 coverage. No destructive or high-volume testing was performed. This review is not a security certification.

## H. Responsive and accessibility review

| Width | Pages inspected | Result |
|---|---|---|
| 375px mobile | All six | No document overflow in tested states; stacked forms/editor and critical actions visible; drawer focus/Escape and loading persistence pass |
| 768px tablet | All six | No overflow; mobile navigation and stacked content pass |
| 1024px laptop | All six | Sidebar and content fit; labels/navigation/actions remain available |
| 1440px desktop | All six | Sidebar, metric grid, research cards and outreach panels fit |

Long unbroken company names, source URLs and message content were included. Checks assert a single main landmark and named form controls, inspect console/page errors, test keyboard focus/Escape/active navigation and reduced motion, and measure the specific sidebar contrast fix. No unexpected browser page/console errors occurred in the final normal responsive scenarios. Expected failed requests during injected-error cases were checked against safe API/UI feedback.

No axe dependency was installed. Full screen-reader testing, exhaustive contrast analysis, every browser engine, zoom level and all generated-text extremes remain outside the verified scope.

### Final screenshots (synthetic data)

| Page | Desktop | Mobile |
|---|---|---|
| Dashboard | [1440px](artifacts/final/screenshots/dashboard-1440.png) | [375px](artifacts/final/screenshots/dashboard-375.png) |
| Profile Analyzer | [1440px](artifacts/final/screenshots/profile-1440.png) | [375px](artifacts/final/screenshots/profile-375.png) |
| Company Discovery | [1440px](artifacts/final/screenshots/discover-1440.png) | [375px](artifacts/final/screenshots/discover-375.png) |
| Decision-makers / Lead Scoring | [1440px](artifacts/final/screenshots/qualification-1440.png) | [375px](artifacts/final/screenshots/qualification-375.png) |
| Outreach Studio | [1440px](artifacts/final/screenshots/outreach-1440.png) | [375px](artifacts/final/screenshots/outreach-375.png) |
| Authentication | [1440px](artifacts/final/screenshots/login-1440.png) | [375px](artifacts/final/screenshots/login-375.png) |

The screenshot directory also contains every page at 768/1024px and [mobile navigation during loading](artifacts/final/screenshots/navigation-loading-375.png): **25 PNGs total**. These are actual application URLs, not the temporary legacy preview page.

## I. Automated verification results

Verified runtime/toolchain: Node **24.18.0**, Next.js **16.4.6**, React **19.3.0**, TypeScript **5.9.3**, Tailwind **4.3.3**, Supabase JS **2.119.2** / SSR **0.12.7**, OpenAI **7.62.0**, Zod **4.6.7**, Vitest **4.1.12**, Playwright **1.65.1**. No dependency versions changed.

| Check | Baseline observed | Final observed |
|---|---|---|
| `npm run lint` | Pass | Pass, exit 0 |
| `npx tsc --noEmit` | Pass | Pass, exit 0 |
| `npx vitest run` | Failed collecting two Playwright suites; underlying 53 tests passed, one skipped | **56 passed, 1 skipped; 11 suites passed, 1 skipped**, exit 0 (2.80s) |
| Baseline Vitest with browser exclusion | **53 passed, 1 skipped** | Superseded by configured default command |
| `npm run build` | No pre-fix build result claimed | **Pass**, exit 0; all existing pages/API routes compiled and 21 prerender entries generated |
| `node scripts/run-final-review.mjs` | Initial browser runs reproduced issues above | **34 passed**, 0 unexpected/flaky/skipped, 123.28s |
| `npx playwright test --config playwright.stage7.config.ts` | **11 passed** against development server | **11 passed** against final production server, 3.6s |
| Live two-user RLS integration | Not configured | **Skipped**; credentials and approved isolated database unavailable |

The final isolated suite consists of **11 API tests, 17 journey tests, and 6 responsive/accessibility tests**. Combined final executions have **101 passing test instances and 1 intentional live-test skip**; this sum is not a count of distinct product features.

One intermediate expanded browser run stalled and ended with 26 passes and 6 timeouts/closed-page errors. Its root cause was not established; no application exception explained it. Subsequent complete runs passed 33 and then 34 scenarios without retries. This history is disclosed rather than treating the intermediate failures as a pass.

Development emitted a slow-filesystem benchmark warning and Cache Components development-cache warnings. Playwright emitted the environment's NO_COLOR/FORCE_COLOR warning. The final `.mts` Vitest configuration removed the loader warning seen while developing the test config. These warnings did not fail final checks. Production started successfully; no production-server runtime errors were emitted during the eleven signed-out checks.

Final isolated machine-readable results: [playwright-results.json](artifacts/final/playwright-results.json). Earlier baseline JSON files in `artifacts/final/` retain reproduction summaries; their old trace attachments may have been cleared by subsequent runs. The existing standalone `scripts/verify-ui.mjs` preview suite was not rerun in this final pass; the actual-page suite exercises the affected shell/workspaces directly.

Reproduce offline unit checks and isolated browser review:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
# Ports 3000 and 54329 must be free; Playwright Chromium must be installed.
node scripts/run-final-review.mjs
```

Do not enable `RUN_RLS_TESTS=1` or live provider evaluations until a separate non-production project and authorized credentials/budget are supplied.

## J. Files modified

The checkout was clean at the start. The following changes belong to this review; no tracked files or dependencies were removed.

### Application fixes

| File | Reason |
|---|---|
| `src/lib/security/same-origin.ts` (new) | Shared browser-authority comparison |
| `src/lib/security/request-guard.ts` | Use shared origin comparison |
| `src/app/api/companies/route.ts` | Add missing company-write origin check |
| `src/app/api/profile/route.ts` | Correct legitimate browser Origin handling |
| `src/app/api/profile/analyze/route.ts` | Shared Origin handling |
| `src/app/api/discover/search/route.ts` | Shared Origin handling |
| `src/app/api/discover/research/route.ts` | Shared Origin handling |
| `src/app/api/discover/save/route.ts` | Shared Origin handling |
| `src/app/api/qualification/contacts/route.ts` | Origin handling and correct lookup-error status |
| `src/app/api/qualification/decision-makers/route.ts` | Origin handling and correct lookup-error status |
| `src/app/api/qualification/score/route.ts` | Origin handling and diagnostic redaction |
| `src/app/api/outreach/drafts/[id]/route.ts` | Origin handling and correct lookup-error status |
| `src/app/auth/confirm/route.ts` | Preserve incoming host for redirect |
| `src/app/login/page.tsx` | Confirmation failure guidance with Suspense |
| `src/app/page.tsx` | Persistent shell and safe count logging |
| `src/app/profile/page.tsx` | Persistent shell around Suspense |
| `src/app/discover/page.tsx` | Persistent shell around Suspense |
| `src/app/qualification/page.tsx` | Persistent shell around Suspense |
| `src/app/outreach/page.tsx` | Persistent shell around Suspense |
| `src/components/dashboard/overview.tsx` | Shell now owned by page |
| `src/components/profile/profile-editor.tsx` | Shell now owned by page |
| `src/components/discover/discover-workspace.tsx` | Candidate button type and page-owned shell |
| `src/components/qualification/workspace.tsx` | Reset contact state and page-owned shell |
| `src/components/outreach/studio.tsx` | Preserve unsaved drafts and page-owned shell |
| `src/components/layout/app-shell.tsx` | Sidebar helper contrast |

### Verification and documentation

| File | Reason |
|---|---|
| `vitest.config.mts` (new) | Separate unit/evaluation discovery from Playwright |
| `tests/unit/same-origin.test.ts` (new) | Origin comparison regressions |
| `playwright.final.config.ts` (new) | Isolated serial Chromium suite and artifacts |
| `scripts/run-final-review.mjs` (new) | Safely start/test/stop isolated application and service processes |
| `tests/fixtures/local-services.mjs` (new) | Local in-memory Auth/database/provider test double |
| `tests/fixtures/provider-preload.mjs` (new) | Redirect/block external provider traffic in isolated run |
| `tests/final/api.spec.ts` (new) | Inventory, guards, errors, ownership and workflow API regressions |
| `tests/final/journeys.spec.ts` (new) | Real-page functional journeys and persistence assertions |
| `tests/final/responsive.spec.ts` (new) | Four widths, long content, navigation, accessibility and screenshots |
| `tests/fixtures/ui-preview.tsx` | Keep legacy preview compatible with page-owned shell |
| `README.md` | Accurate commands, new test paths/runner and security coverage clarification |
| `FINAL_TEST_REPORT.md` (new) | Findings, fixes, evidence and readiness limitations |
| `artifacts/final/*` (new) | Final results, local logs, synthetic record audit, baseline result summaries and screenshots |

An artifact manifest is provided in [artifact-manifest.json](artifacts/final/artifact-manifest.json). Generated Next.js types/caches are ignored build outputs, not application changes. Existing `artifacts/ui/` screenshots were not replaced.

## K. Remaining limitations and recommendations

1. **Obtain authoritative SQL migrations and policies.** No database definitions are included here. Verify owner RLS, RPC execute privileges, daily/hourly quota logic, uniqueness/atomicity and draft revision/timestamp triggers in an approved non-production project.
2. **Run a dedicated-account live smoke test.** Confirm real registration email delivery, login/session refresh/logout, durable PostgreSQL writes/reloads, cross-user isolation and dashboard comparisons without touching the owner's profile/customer records.
3. **Evaluate provider quality only with explicit budget approval.** No real OpenAI/Tavily calls were made. Local citations and deterministic model outputs verify contracts, not factual research quality, real relevance or provider availability.
4. **Review deployment origin/proxy configuration.** Local Host normalization is covered; the deployed reverse proxy and HTTPS authority behavior were not available for testing.
5. **Consider uniform request hardening.** Streaming byte caps/content-type checks and hourly limits are not uniformly applied across older feature routes. Preserve existing RPC contracts while planning any expansion.
6. **Review contact duplicate handling and saved outreach context.** Contact saving has no confirmed application-level duplicate-detection flow. Saved personalization facts/cautions are not fully exposed when reopening drafts. These were reported rather than implemented as unrelated features.
7. **Broaden accessibility/browser coverage.** Add screen-reader and cross-engine review; custom DOM/contrast checks here do not prove complete WCAG compliance.
8. **Monitor browser-run stability.** One intermediate run stalled for an undiagnosed reason; final runs were clean, but the isolated suite should be repeated in CI to characterize reproducibility.

No authorization was requested for live services because useful local/mock testing could proceed without it. No live API budget was assumed. No remaining real test records require cleanup.

## L. Final readiness assessment

**Not ready for Stage 8.** The code builds, the final local checks pass, all six real page routes were exercised, and the twelve identified issue groups have passing regression coverage. However, database policies/schema/triggers and live auth/persistence are central to Stages 2–7 and remain unverified. Restore/review the authoritative database definitions and complete an approved isolated Supabase smoke/RLS run before treating Stage 7 as fully validated or advancing with production-readiness claims.
