# Saved-record browsers

Four authenticated read-only pages are available from the sidebar and dashboard:

- `/companies`: saved businesses, websites, industry/location, status, full research summaries and supporting sources.
- `/contacts`: saved contact candidates with company/role, original verification source, LinkedIn link and notes. Candidates are not presented as independently verified.
- `/leads`: companies whose latest saved assessment scores at least 70, with explanation, confidence and saved evidence. A newer below-threshold score excludes an older strong score.
- `/drafts`: all saved outreach records, across channels and workflow statuses, with complete subjects/bodies and approval/manual-send metadata.

Each page provides server-side search, relevant filters, name/date sorting (plus highest-score sorting for leads), expandable full records, refresh, empty/error/loading states, and pagination of 20 records. Submit text using Search; dropdowns apply immediately and criteria live in the URL. External links permit only HTTP/HTTPS. No AI calls or message delivery occur on these pages.

Database reads execute in the invoker-rights `list_saved_records` RPC after `auth.getUser()` and an authenticated read-budget claim. The RPC derives ownership from `auth.uid()`, validates query bounds, applies literal search and filtering in SQL, picks the latest company score before qualification, and returns only 20 records. Company filter choices are capped at 100; search still covers all company names. Supporting sources are capped at 50 per returned company and score evidence at eight. These bounds avoid downloading entire accounts into either Next.js memory or the browser.

**The two ordered security migrations must be installed against the existing schema before this application version is deployed.** The configured hosted project received both migrations on 25 November 2026 with user authorization. Other databases require the same reviewed setup. Missing safeguards/RPCs return safe errors; there is no unlimited fallback. Review the [security migration](../supabase/migrations/202611250001_security_boundaries.sql), [pagination migration](../supabase/migrations/202611250002_paginated_records.sql), and [read-only audit](../supabase/security-audit.sql). A failed query produces an error and retry action rather than an empty success state.

“Open lead research” preselects the associated owned company, even if it falls outside the Qualification workspace's first 100 choices. “Open Outreach Studio” opens the existing writing workspace; full details for every saved draft remain available in the list, including older drafts beyond the Studio's existing 100-draft API window.

## Verification

Use the local HTTP service doubles to avoid modifying the configured Supabase project or spending API credits:

```bash
FINAL_REVIEW_ARTIFACT_DIR=artifacts/saved-records node scripts/run-final-review.mjs
```

The dedicated `tests/final/saved-records.spec.ts` covers protected/empty pages, a 520-company dataset spanning multiple database batches, search/pagination, company preselection, contact sources, rejection of unsafe URL schemes, latest-score qualification, all draft statuses, filters, reloads, two-user isolation at the application/mock layer, database-error retry, and all four pages at 375/768/1024/1440px. Latest-score selection is implemented in SQL; `scripts/verify-security-database.mjs` checks that a newer weak score excludes an older qualified score.

The runner's optional artifact directory preserves historical final-review output. The HTTP database double now models offset/limit pagination and multi-column ordering so batch-read assertions reflect actual PostgREST semantics. The current application requires the two security overlays described above; no new runtime dependencies are required.

## Limits

These checks do not certify deployed PostgreSQL RLS or schema compatibility; an approved isolated real Supabase environment remains necessary for that verification. Reads now use SQL filtering and bounded server pagination. Exact counts and deep offsets still require database work; query execution limits, indexes, and appropriate account/edge controls should be verified on the deployment. Concurrent inserts/deletes can shift offset pages; refresh after updates.

The dashboard's pre-existing qualified-lead count still uses its latest 1,000 score rows, while the new lead list selects latest assessments in SQL. The existing calculation and scoring threshold were preserved. A future database-backed latest-score query can make both complete and scalable.

## Saved-record implementation results — 25 November 2026

These results describe the initial list implementation before the subsequent security changes; rerun the current suite for regression results after subsequent security changes.

### Original checks

- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npx vitest run`: 58 passed; one opt-in live RLS test skipped.
- `npm run build`: passed, including all four new protected routes.
- Full isolated Playwright regression suite: **42 passed**, zero failures/skips/flaky results, 132.81 seconds. This includes eight dedicated saved-record browser tests and all 34 existing workflow/API/responsive tests.
- All four new pages checked at 375, 768, 1024 and 1440 pixels without document overflow.
- Initial focused tests exposed selector mismatches in the new tests; those selectors were corrected, explicit filter accessible names were added, and retry/refresh now uses a pending-aware client refresh button. The rerun passed all eight dedicated tests, followed by the complete 42-test run.

Generated browser reports and synthetic screenshots are written under `artifacts/saved-records/` and excluded from Git. Run the command above to regenerate them locally. Historical reports are not required at runtime. No live provider calls or real database writes are made by this isolated runner.
