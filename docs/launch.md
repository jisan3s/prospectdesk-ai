# Launch and recovery

The application is publicly reachable at https://prospectdesk-ai.netlify.app. Broader production readiness still depends on the outstanding authenticated, email-delivery, and recovery checks below.

## Verified status — 26 November 2026

| Check | Result | Scope |
| --- | --- | --- |
| Public browser/API smoke suite | 27 passed | Login/signup UI at four widths, all nine protected pages, all 13 data API methods, security headers; signed out only. |
| ESLint and generated-route TypeScript checks | Passed | Local checkout. |
| Vitest | 63 passed; one skipped | Offline tests; dedicated live RLS test skipped. |
| Isolated local browser regression | 73 passed | 46 workflow tests plus 27 signed-out smoke checks, using local service doubles. |
| PostgreSQL security fixture | 19 passed | Isolated database, not production persistence. |
| npm audit | Zero known vulnerabilities | Installed dependency advisories at review time; not a complete security audit. |
| Public login JavaScript | Nine directly referenced scripts checked; no provider credentials detected | Does not cover every deployed asset. |
| Hosted anonymous table access | All seven tables rejected zero-row anonymous reads with HTTP 401 | No business records retrieved or changed. |
| Hosted Auth | Email/password enabled; email confirmation enabled; signup enabled | Public Auth settings endpoint. |
| Invalid confirmation-link redirect | HTTPS hosted origin | One synthetic invalid token; no real token consumed or email sent. |

Netlify built release `3038bd7` successfully. The earlier GitHub production verification also passed for `1598574`; subsequent runs are visible in [Actions](https://github.com/jisan3s/prospectdesk-ai/actions). A local production build is restricted by an internal Turbopack port-binding permission, so production builds are verified remotely.

Still outstanding: fresh signup/confirmation email delivery, valid-login/logout persistence on the deployed host, dedicated staging writes and cross-user live RLS tests, budgeted provider smoke tests, operational monitoring/abuse-control review, and a real backup/restore drill. No paid provider requests, real outreach, account creation, or business-record writes were performed during this review.

## Automated gate

The GitHub Actions `Verify application` workflow uses Node 24 and synthetic credentials. It runs dependency auditing, lint, generated-route type checks, unit tests, isolated PostgreSQL security checks, then a production build and the full workflow suite against `next start`. With `FINAL_REVIEW_SMOKE=1`, it also runs the signed-out smoke suite against that same local instance. The smoke target is forced to loopback, even if an external `E2E_BASE_URL` is inherited. The workflow does not deploy or call live providers.

Checkout, Node setup, and artifact upload use verified Node 24 action releases pinned to full commit revisions. Checkout does not persist its GitHub credentials after fetching the source; workflow permissions remain read-only.

To run the same production browser check locally with ports 3000 and 54329 free:

```bash
FINAL_REVIEW_MODE=production FINAL_REVIEW_SMOKE=1 FINAL_REVIEW_ARTIFACT_DIR=artifacts/launch node scripts/run-final-review.mjs
```

A failed build stops the runner before browser tests. Logs and screenshots remain in the ignored artifact directory. Both build and runtime use the local service-double URL; this output must never be deployed against the hosted project. Build a separate release with the correct production public variables.

## Staging acceptance

Use a separate Supabase project and two confirmed test accounts. Put credentials in ignored local environment files or the hosting secrets manager, never in Git or chat. This checkout currently has no staging credentials configured.

Before writes, record the approved project reference and confirm that it contains no real business records. Provision the authoritative base schema before the two additive security migrations. The test fixture is not a production schema.

Record returned IDs for dedicated test records, refresh each page to check persistence, and verify:

1. Login, logout, email confirmation, expired-session redirects, and inaccessible signed-out pages/APIs.
2. Profile create/edit/reload, company research/save/duplicate detection, contact capture, scoring, and dashboard counts.
3. LinkedIn/email draft creation, edit/reload, submit/reject/revise/approve, stale revisions, confirmed manual-send tracking, and follow-up eligibility. No messages are transmitted by the application.
4. Two-user isolation for all seven owner-scoped tables and both new RPCs, including direct Data API writes and parent ownership checks. The existing live RLS test covers companies only.
5. Minute/hour/day quotas, failure recovery, and no provider calls after a rejected quota claim.

The existing live RLS test can be run only after the target is independently confirmed as non-production. Its exact test-company cleanup is part of that workflow:

```bash
RUN_RLS_TESTS=1 node --env-file=.env.stage7.test.local node_modules/vitest/vitest.mjs run tests/integration/rls.integration.test.ts
```

It requires `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, and `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`. A Node environment flag cannot establish whether a hosted database is production.

Live OpenAI/Tavily tests require a separately agreed request and spending budget. Local mocks remain the default. Application timeouts/quotas are not a dollar-denominated billing cap.

## Deployment gate

### Netlify Free setup

The root `netlify.toml` sets Node 24, `npm run build`, and `.next` output. Netlify supplies the Next.js adapter automatically; do not deploy a static export or the service-double build from CI.

1. Import `jisan3s/prospectdesk-ai` into the existing Netlify account. Grant repository access only to this project when prompted, after reviewing the permissions. Select the Free plan and do not enable paid add-ons.
2. Set the production branch to `refactor/codebase-cleanup` for the current release. Do not accidentally deploy the older `main` revision.
3. Add the values from `.env.local` through Netlify's protected environment settings. Supabase public variables must be available during the build and in functions. Provider keys must be available to functions and remain server-only. Never enter real values into `netlify.toml` or commit them.
4. Deploy and record the resulting HTTPS `netlify.app` URL. Check build/adapter logs and the running login page before configuring Auth URLs.
5. Set the Supabase Site URL to the chosen canonical HTTPS origin and allow its exact `/auth/confirm` URL. Retain any existing approved local/staging redirects; do not add broad wildcard redirects.
6. Verify login/confirmation/logout, signed-out route/API rejection, private responses, and mobile navigation on the deployed host. Keep mutating or paid tests gated by the staging and spending approvals above.

Netlify project `prospectdesk-ai` has been provisioned at `https://prospectdesk-ai.netlify.app`. Deployment `6b082da5aec8d7f75af64ebe` built commit `3038bd7` successfully on 26 November 2026 using Next.js 16.4.6, Node 24, and Netlify Next.js Runtime 5.16.9. The build's secret scan reported no secrets in 177 scanned files. Five environment variables are saved in Netlify, with provider keys masked; no credential values belong in this document.

The project is now public: external browsers reach the login page, while application pages and data APIs still enforce Supabase authentication. The 27 signed-out smoke checks passed on the public deployment. Protected streamed pages may initially return HTTP 200; browser tests verify that the actual navigation ends at `/login`, rather than treating the initial status as proof of access.

A synthetic invalid verification link redirects to `https://prospectdesk-ai.netlify.app`, confirming that the provider's default error redirect no longer points at localhost. Email confirmation remains enabled. Gmail SMTP setup was discussed with the maintainer, but current SMTP credentials, the exact allowlist/template, and fresh email delivery were not inspected or exercised during the final public review. Verify them directly before relying on public signup. Keep real passwords and confirmation links out of reports and Git. Do not disable email confirmation to work around delivery failures.

Repeat the public smoke suite without account creation, database writes, or provider calls:

```bash
E2E_BASE_URL=https://prospectdesk-ai.netlify.app npx playwright test --config=playwright.stage7.config.ts
```

The 27 scenarios cover responsive login/signup controls at four widths, all nine protected pages, all 13 data API methods, and application security headers. This is not authenticated workflow or email-delivery verification. Historical reports and new generated evidence are kept separately; final-review artifacts under `artifacts/launch/` are ignored by Git.

Hosting limits and commercial-use terms should be reviewed in the [Free-plan documentation](https://www.netlify.com/blog/introducing-netlify-free-plan/) and [pricing](https://www.netlify.com/pricing/).

### Release checks

- Select hosting, production domain, and a staging URL; use separate secret scopes for staging and production.
- Set the five variables in `.env.example` as appropriate. Public Supabase values are embedded at build time; provider keys remain server-only.
- Set Supabase Site URL and allowed redirects to the exact HTTPS deployment URLs. Verify the email template uses `/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- Require a passing production build and browser suite for the release revision. Verify login and private/no-store responses on the actual deployed host.
- Confirm HTTPS redirects, CSP, HSTS, frame restrictions, cookie behavior, and no shared caching of user-specific responses through the host/CDN.
- Configure hosting-level abuse controls and account/signup protections. Confirm provider quotas and project budgets in their dashboards; record their actual enforcement behavior.
- Configure uptime and sanitized error monitoring with a named responder. Do not log profile text, tokens, prospect details, or provider payloads.
- Complete the recovery drill below and record the approved retention and recovery targets before accepting real users.

## Backup and recovery drill

The existing private pre-security JSON file is **metadata only**. It contains no business rows and cannot recover the complete application or Auth accounts.

1. In the Supabase dashboard, verify the project's actual backup availability, latest successful backup, retention, and recovery coverage. Do not assume a plan includes a usable restore point.
2. Use an approved platform backup or the official logical-backup procedure. Keep exports encrypted outside Git with restricted access. Include application schemas, private quota schema, functions, policies, grants, triggers, Auth dependencies, and required extension configuration. Keep the authoritative schema migration history separately versioned after review.
3. Record project settings not recreated by SQL: Auth URLs/email templates, SMTP, secrets, hosting variables, and any integrations. Database backups do not contain Storage object contents; back those up separately if Storage is introduced.
4. Restore into a **separate approved recovery project**, never over production during a drill. Isolate outbound provider/email integrations and scheduled jobs before using restored data. A copy containing real data remains sensitive.
5. Compare table counts and representative owned records, sign-in/confirmation behavior, policies/grants, quota functions, saved-record RPCs, and outreach revision/approval timestamps. Test cross-user isolation and the approved workflow without transmitting outreach.
6. Record backup timestamp, restore duration, expected data loss window, errors, and exact recovery steps. Retain evidence privately and agree on how often to repeat the drill.

For an application-only incident, roll back to a known compatible application build. Do not drop the security overlays or reset production data as a rollback shortcut. Database recovery or endpoint changes require a reviewed incident plan.

Provider procedures: [Supabase database backups](https://supabase.com/docs/guides/platform/backups) and [backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). No backup/export/restore has been executed by adding this runbook.
