# Launch and recovery

Public launch is pending the checks below. A green mocked test suite does not certify the hosted environment.

## Verified status — 26 November 2026

- Local lint, generated-route TypeScript checks, 63 unit tests, 46 development browser tests, and 19 isolated PostgreSQL security checks passed. One opt-in live RLS test was skipped.
- The production build and browser regression step passed in [GitHub Actions](https://github.com/jisan3s/prospectdesk-ai/actions/runs/45818249396) for commit `1598574`. The local build remains restricted by an internal port-binding permission; the remote production step completed successfully.
- Read-only checks on the previously approved hosted Supabase project rejected anonymous zero-row reads on all seven application tables (HTTP 401). Email/password auth is enabled, email auto-confirm is disabled, and signup is enabled. No hosted records were read or changed by these probes.
- Still outstanding: staging persistence and multi-user live RLS checks, real confirmation email delivery, production host/CDN checks, budgeted provider smoke tests, configured monitoring/abuse controls, and a real backup/restore drill. No hosting deployment was found in GitHub deployment metadata; hosting/domain and staging access must be supplied.

## Automated gate

The GitHub Actions `Verify application` workflow uses Node 24 and synthetic credentials. It runs lint, generated-route type checks, unit tests, isolated PostgreSQL security checks, then a production build and the full browser suite against `next start`. It does not deploy or call live providers.

To run the same production browser check locally with ports 3000 and 54329 free:

```bash
FINAL_REVIEW_MODE=production FINAL_REVIEW_ARTIFACT_DIR=artifacts/launch node scripts/run-final-review.mjs
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
