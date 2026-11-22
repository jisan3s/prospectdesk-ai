# ProspectDesk AI — codebase audit and cleanup

Audit date: November 23, 2026. Scope: safe cleanup and targeted refactoring of the existing application, with the modernized UI, API contracts, authentication, quotas, evidence handling, and manual outreach workflow preserved.

## Result

**12 finding groups:** 3 safe-cleanup groups and 6 refactoring groups addressed; 3 higher-risk groups retained for follow-up. Five unreferenced starter assets were deleted. No dependencies were removed or upgraded. The post-cleanup lint, TypeScript, offline tests, production build, production browser suite, and mocked feature workflows passed.

The working tree initially contained a user change in `src/app/actions/auth.ts` adding its final newline. Its exact initial contents were preserved; it is not part of this cleanup's modifications.

## Audit coverage and method

Reviewed `AGENTS.md`, the manifest and lockfile, TypeScript/Next.js/ESLint/Playwright configuration, Tailwind global styles, all application/component/library areas, API routes, public assets, scripts, tests, environment-variable references, and README. Read the installed Next.js guides for Server/Client Components, CSS, and authentication with Cache Components before editing.

There is no `src/hooks/` or Supabase migrations/configuration directory in this checkout. `src/types/` has no source files. No schema, policies, RPCs, or triggers could be audited from SQL files.

Checks included strict unused-symbol diagnostics, import/dependency searches, dynamic-import and public-URL searches, framework entry-point review, baseline file fingerprints, prompt/output-budget comparisons, baseline/regression commands, and mocked browser workflows. No paid OpenAI/Tavily calls or live database mutations were performed.

## Findings

| ID | Category | Finding and impact | Resolution |
| --- | --- | --- | --- |
| A1 | Safe cleanup | Five Next.js starter SVGs had no references in source, scripts, tests, configuration, documentation, or URL construction. They were not framework-required entry points. | Removed the five assets listed below. The favicon under `src/app/` remains. |
| A2 | Safe cleanup | Three components aliased the shared `field` class through redundant local constants. Profile saving also returned a boolean that no caller consumed and accepted an optional event despite being used only as the form handler. | Use the shared class directly and a required form event with `Promise<void>`. Profile text-field keys exclude the array fields. |
| A3 | Safe cleanup | The mobile dialog carried a `mobile-drawer` class with no CSS selector or script/test reference. | Removed the marker; retained every actual Tailwind class and native dialog behavior. |
| B1 | Refactoring | Discovery, Qualification, Outreach, and Profile duplicated JSON parsing and handled failed/malformed responses differently. Some error paths could pass unchecked data into rendering. | Added one no-retry browser request helper with HTTP status preservation, safe error extraction, cancellation support, and schema validation of consumed successful data. |
| B2 | Refactoring | Discovery used double casts; qualification/outreach readers inferred unchecked JSON; search/evidence/draft shapes were repeated. Draft status was an unconstrained string. | Added shared response schemas and inferred types; removed unchecked response casts. Kept distinct local database projection types where their fields differ. Discovery field limits now come from its existing input schema. |
| B3 | Refactoring | Dashboard icons, links, and descriptions relied on matching array indexes. Reordering metrics could silently associate the wrong destination or icon. | Replaced parallel arrays with typed metadata keyed by the existing metric labels. Queries and metric calculations remain the same. |
| B4 | Refactoring | Outreach duplicated initial/list-refresh processing; generation refreshed a list despite already receiving the complete saved draft, and its old refresh helper swallowed failures before a success notice. Initial-load failures also lacked error styling. | Validate the generated draft and insert/deduplicate it locally within the existing 100-draft display limit. Keep canonical refreshes after edit/review transitions. Abort initial reads on unmount and suppress cancelled updates; disable generation during the initial read. Correct candidate/copy/list feedback tones. |
| B5 | Refactoring | The opt-in live-evaluation script used top-level `await` under the current CommonJS transform mode, preventing execution before its opt-in guard. | Wrapped it in an asynchronous entry point. Preserved the explicit opt-in, credential guard, prompts, two cases, budgets, and no-retry options. Failure logging avoids raw provider diagnostics. |
| B6 | Refactoring | Four Scout modules repeated provider construction and model fallback configuration. | Added a server-only factory/model selector, preserving the profile timeout of 30 seconds, the other 25-second timeouts, zero retries, and the current model fallback. |
| C1 | Retain for review | Database schema, migrations, RLS definitions, grants, quota SQL, and outreach revision/timestamp triggers are absent. Their deployed behavior cannot be established here. | No database changes. Obtain authoritative SQL and verify against a dedicated development project before claiming database-level isolation or concurrency guarantees. |
| C2 | Retain for review | The shared Stage 7 origin/content-type/bounded-body/hourly guard is integrated only into outreach generation. Other routes use varying local checks and daily quota calls. | Preserved all existing safeguards and HTTP contracts. Extending coverage and adding deployment-wide abuse controls needs a separate security change and integration tests. |
| C3 | Retain for review | Existing live integration coverage is limited: opt-in RLS checks only companies, live eval covers two synthetic cases, and some API database errors have different classification/handling. No dedicated credentials were supplied for end-to-end persistence/provider checks. | Retained routes, fixtures, and tools. Documented the unverified workflows rather than changing SQL or server response semantics in a cleanup. |

ESLint and strict TypeScript reported no unused imports or local variables at baseline. No additional source file or component was proven obsolete. Repetitive authentication, owner filters, quota checks, structured output validation, and prompt defenses have different responsibilities and were retained.

## Files modified

| File | Change |
| --- | --- |
| `README.md` | Document shared utilities, removed starter-assets directory, repaired eval invocation, optional local UI-test settings, and this report. |
| `scripts/run-live-evals.ts` | Compatible async entry point and sanitized failure handling; no paid run performed. |
| `scripts/verify-ui.mjs` | Optional loopback-only base URL and separate artifact directory, contract-aligned fixtures, and additional malformed-response/list-error/field-limit/request-count assertions. |
| `src/app/page.tsx` | Type dashboard metric labels without changing Supabase queries or calculations. |
| `src/components/dashboard/overview.tsx` | Replace parallel metric metadata arrays with a typed lookup. |
| `src/components/discover/discover-workspace.tsx` | Shared validated requests, inferred response types, retained duplicate status, schema-derived field limits, and consistent handler/feedback structure. |
| `src/components/layout/app-shell.tsx` | Remove the unused dialog marker class. |
| `src/components/outreach/studio.tsx` | Shared validated requests/draft types, abortable initial load, error feedback, removal of the redundant generation read, and redundant class-alias cleanup. |
| `src/components/profile/profile-editor.tsx` | Shared validated requests, narrower editable field keys, form-handler cleanup, and redundant class-alias cleanup. |
| `src/components/qualification/workspace.tsx` | Shared validated requests/search/evidence types and redundant class-alias cleanup. |
| `src/lib/ai/company-research.ts` | Use shared provider configuration; keep research prompt, citations, output format, and budget. |
| `src/lib/ai/outreach.ts` | Use shared provider configuration; keep writing prompt, output format, and budget. |
| `src/lib/ai/qualify.ts` | Use shared provider configuration and evidence type; keep scoring rubric, normalization, citations, and budget. |
| `src/lib/ai/scout.ts` | Use shared provider configuration with the original longer timeout; keep analysis prompt/output/budget. |
| `src/lib/research/tavily.ts` | Reuse the search-hit type through a type-only import; no request/filter/timeout changes. |

## Files added

| File | Purpose |
| --- | --- |
| `src/lib/http/client.ts` | Browser `requestJson`, `postJson`, and `HttpError`. |
| `src/lib/validations/responses.ts` | Runtime contracts for fields actually consumed by the workspaces, plus inferred search/evidence/draft types. Extra server metadata remains compatible. |
| `src/lib/ai/client.ts` | Server-only Scout client/model configuration. |
| `tests/unit/http-client.test.ts` | Successful/malformed JSON, 409/429/503 errors, safe fallbacks, empty errors, cancellation, POST shape, and no retries. |
| `tests/unit/api-responses.test.ts` | Valid draft states/optional timestamps, extra metadata, malformed draft fields, search fallbacks, and incomplete research/qualification data. |
| `tests/unit/scout-client.test.ts` | Mocked missing-key, timeout, model selection, and retry safeguards. |
| `docs/codebase-audit.md` | Audit, file inventory, verification, and retained concerns. |

## Files removed

| File | Why removal was safe within this repository |
| --- | --- |
| `public/file.svg` | Unreferenced starter illustration. |
| `public/globe.svg` | Unreferenced starter illustration. |
| `public/next.svg` | Unreferenced framework starter logo. |
| `public/vercel.svg` | Unreferenced hosting starter logo. |
| `public/window.svg` | Unreferenced starter illustration. |

Repository-wide reference searches included imports, dynamic imports, string URLs, documentation, tests, configuration, and build usage. These assets are not Next.js special files. No production/user content, environment files, migrations, routes, or fixtures were deleted. No new dependency or lockfile edit was required.

## Dependency review

All **20 direct packages** have an established purpose:

- Runtime/framework: Next.js, React, React DOM, `server-only`.
- Data/auth: Supabase JS and SSR clients.
- AI/validation: OpenAI and Zod; Tavily uses native fetch.
- UI/build: Lucide, Tailwind CSS, and the existing Tailwind Turbopack loader.
- Types/checks: TypeScript, Node/React/React DOM type packages, ESLint, and the Next.js ESLint configuration.
- Testing/scripts: Vitest, Playwright, and `tsx` (including the now-compatible eval runner).

No package was removed solely because it lacked a direct import. Framework peers, type packages, CSS/build loaders, and command-line tooling were included in the review. `package.json` and `package-lock.json` retain their baseline fingerprints; no upgrade or forced dependency resolution was performed.

## Verification results

| Check | Baseline | After cleanup |
| --- | --- | --- |
| `npm run lint` | Passed | Passed |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | Passed | Passed |
| `RUN_RLS_TESTS=0 npx vitest run --exclude 'tests/e2e/**'` | 30 passed, 1 skipped; 7 suites passed | 53 passed, 1 skipped; 10 suites passed |
| `npm run build` | Passed | Passed; original routes and Cache Components retained |
| Playwright signed-out/API/login suite | 11 passed against the existing local production server | The same 11 tests passed against an isolated freshly started production server |
| Mocked feature/responsive script | Existing fixture suite reviewed; not separately rerun as a pre-edit baseline | Passed: 49 intercepted requests, 28 screenshots, no recorded browser errors, no overflow at 375/768/1024/1440px |
| Disabled live-eval gate | Source-level module-mode issue identified; the same issue was observed in the preceding README audit | Expected exit 1 with the opt-in message, without a provider call |
| Missing-key live-eval gate | Not separately executed before cleanup | Expected exit 1 with the missing-key message, without a provider call |
| Live RLS / paid provider evaluation | Not run | Not run |

The post-cleanup Playwright run used the existing configuration through a temporary wrapper in `/tmp`, overriding only the test-directory location, output directory, and base URL to `http://127.0.0.1:3002`. The repository's Playwright configuration and test files were not changed. The existing port 3000 server was left alone. The isolated development server used port 3001.

Mocked feature checks used:

```bash
UI_TEST_BASE_URL=http://127.0.0.1:3001 UI_ARTIFACT_DIR=/tmp/prospectdesk-cleanup-ui node scripts/verify-ui.mjs
```

Artifacts remain in `/tmp/prospectdesk-cleanup-ui`; the checked-in screenshots/results under `artifacts/ui/` retain their baseline contents. A desktop dashboard screenshot was visually inspected. No pixel-diff or full assistive-technology audit was performed.

### Invariants checked

- Fingerprints match for all **32 baseline API, Supabase, security, input-validation, and configuration files** in the protected comparison set.
- `src/app/actions/auth.ts` exactly matches its initial user-modified contents.
- Prompt strings and `max_output_tokens` / `store` options match for all four Scout workflows and the live eval runner.
- Client configuration tests cover the preserved model fallback, configured override, timeouts, zero retries, and missing-key refusal.
- The build contains no temporary `ui-review` route; the fixture cleanup removed it.
- The dashboard's real-data queries, latest-score calculation, ≥70 threshold, and draft-status count filter remain unchanged.
- No secret was moved into browser code, no database operation was executed for cleanup, and no automatic sending was introduced.

## Functionality evidence and limits

| Area | Evidence | Not established by this cleanup |
| --- | --- | --- |
| Foundation/navigation/UI | Production build, responsive login checks, native mobile dialog checks, mocked feature views. | Full screen-reader/high-zoom review or every navigation edge case. |
| Authentication/authorization | All protected-page redirects and existing signed-out API tests pass; auth/Supabase/API source remains unchanged. | Live registration/login/confirmation with supplied user credentials or deployed RLS behavior. |
| Profile/research/company saving | Mocked save/analyze/search/research/source/duplicate/rate-limit/retry workflows pass; input and output contracts pass tests. | Actual provider responses, RPC persistence, daily quota reset/atomicity. |
| Decision-makers/scoring/dashboard | Mocked contact capture, evidence selection, score display, and metric presentation; scoring prompts/calculations and owner-filtered queries unchanged. | Independent verification of contacts or real database metric values. |
| Outreach | Generation, edit/save, submit, rejection, revision, return-to-draft, approval, and manual-send cancellation/confirmation tested under mocks. Generation's redundant read removal is asserted. | Deployed revision/timestamp triggers, concurrent live edits, or real message transmission (the application does not send messages). |
| Stage 7 safeguards | Existing code preserved, unit/safety contracts pass, signed-out requests denied, no-retry provider options checked. | Complete prompt-injection resistance, per-IP abuse controls, all quota RPCs, or comprehensive RLS/provider-failure coverage. |

## Remaining recommendations

1. Restore authoritative SQL migrations/policies/grants/RPCs/triggers and verify them in a separate development project. Do not reconstruct production SQL or drop anything based on this audit.
2. Review consistent body-size/origin/hourly safeguards across costly routes and deployment-level abuse protection as a separate security change, with tests preserving intended HTTP contracts and quota semantics.
3. Expand dedicated-account tests to all user-data tables, concurrent revisions, authenticated persistence, quota behavior, and provider timeouts/outages. Real model evaluation requires explicit opt-in and API credits.
4. Review remaining server-side query-error classification separately rather than changing 404/500 behavior during cleanup. Qualification's manual contact fields also persist when switching companies; consider a deliberate context-change/unsaved-work UX policy.
5. Keep the existing unsaved-draft navigation and safe personalization-context improvements as later workflow work. This cleanup does not add sending, integrations, or autonomous actions.

Uncertain framework entry points, public-facing API routes, security action variants, and adversarial fixtures were retained. No further deletion is recommended without concrete reference and behavior evidence.
