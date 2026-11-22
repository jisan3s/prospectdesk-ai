# ProspectDesk AI — UI modernization

Completed November 23, 2026.

## What changed

- **Application shell:** shared desktop sidebar, route-aware navigation, topbar, Scout identity, sign-out action, skip link, and native mobile navigation dialog. The dialog contains keyboard focus, closes with Escape, and restores focus to its trigger.
- **Dashboard:** real Supabase metrics remain server queried, with the original latest-score and ≥70 qualification calculation and original draft-status filter. Metric cards link to the existing workflows. Failed queries display an unavailable value and feedback instead of a misleading zero. Added practical next-step shortcuts.
- **Scout Profile:** clearer field hierarchy, a separate recommendations panel, supported strengths, cautions, empty analysis guidance, and consistent save/validation feedback. Analysis remains disabled while edits are unsaved. Dates explicitly use UTC to avoid server/browser timezone mismatches.
- **Discovery:** keyboard-submittable search form, source cards labeled as candidates, search skeletons, actionable empty states, researched/saved badges, and a duplicate badge driven exclusively by an actual HTTP 409 from the existing save endpoint. Pending fields and actions are disabled; rate-limit errors preserve retry behavior.
- **Qualification:** saved-company selection, an accessible numeric score meter, the existing ≥70 qualification threshold, confidence badges, source links, positive signals, risks, and contact-candidate verification guidance. No independently verified status is inferred.
- **Outreach Studio:** responsive saved-draft list and writing panel, status and channel badges, real creation dates, recipient context, contact source links, research navigation, larger editor, unsaved-change guidance, copy feedback, and consistent pending/error states. Every existing transition remains present. The original manual-send confirmation remains mandatory.
- **Authentication:** centered branded login/signup panel, consistent labels and inputs, disabled pending controls, distinct error/success feedback, and recoverable connection-error feedback using the existing Supabase calls.

No API handlers, Supabase clients, security modules, AI/search integrations, validation schemas, migrations, database policies, dependency manifests, or Next.js configuration were changed. No automatic sending was introduced.

## Existing route map

| Route | Interface |
| --- | --- |
| `/` | Dashboard |
| `/profile` | Scout Profile |
| `/discover` | Company discovery and research |
| `/qualification` | Saved-company selection, lead scoring, decision-maker research, contact capture |
| `/outreach` | Outreach Studio |
| `/login` | Login and signup |

Navigation points only to these existing pages. Separate Companies, Contacts, and Settings pages were not present. Existing authentication checks, request-time rendering, and Suspense boundaries remain in their server pages.

## Design system

| Area | Convention |
| --- | --- |
| Background | `--background: #f6f8fb` |
| Surface | `--surface: #ffffff` |
| Text | `--foreground: #172033`; slate-950/900 headings and slate-600 secondary copy |
| Primary | `--primary: #4f46e5`; indigo actions and selected navigation |
| Scout accent | `--accent: #0f766e`; teal identity and research accents |
| Borders | `--border: #e2e8f0` |
| Feedback | Emerald success, amber caution, red errors, indigo informational feedback; always accompanied by text |
| Typography | Existing Geist Sans and Geist Mono variables; 24–30px page titles, 18–20px section headings, 14px body/fields, 12px helper text, 36px dashboard values |
| Spacing | Tailwind spacing scale; 16px mobile / 32px desktop page gutters; 20–24px panels; 16–32px section gaps |
| Surfaces | 16px card radius, 8px fields/actions, light borders and subtle shadows |
| Focus | Visible 3px indigo outline with 3px offset |
| Touch targets | Inputs and primary/secondary actions at least 44px tall |
| Motion | Short color transitions; animations and transitions disabled for reduced-motion preferences |

Shared React primitives: `Brand`, `Badge`, `PageHeading`, `Alert`, `EmptyState`, and `LoadingSkeleton`. Shared Tailwind component classes: `workspace`, `panel`, `field`, `button-primary`, `button-secondary`, and `icon-button`. Existing native inputs, textareas, selects, and confirmation dialogs are reused.

Default Tailwind breakpoints are retained: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. The sidebar appears at 1024px. The Profile and Outreach split panels activate at 1280px to preserve usable widths alongside the sidebar. Metric cards stack to one column on mobile, two on smaller screens, and four on wide screens.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npx vitest run --exclude 'tests/e2e/**'` | 30 passed, 1 skipped; seven suites passed, dedicated RLS integration suite skipped |
| `npm run build` | Passed; original routes only, Cache Components retained |
| `npx playwright test --config playwright.stage7.config.ts` | 11 passed against production server |
| `node scripts/verify-ui.mjs` | Passed against development server with synthetic fixtures and intercepted APIs; 45 mocked requests, 28 screenshots, no recorded browser errors |
| Responsive widths | 375, 768, 1024, and 1440px; no horizontal page overflow in tested views |
| Mobile navigation | Opens, contains keyboard focus, closes with Escape, returns focus |

The package has no `test` npm script, so Vitest was invoked directly. Playwright tests are excluded from Vitest and run with the existing Playwright configuration.

The initial production build failed because Turbopack's CSS worker could not bind a local port in the sandbox. After running with local-worker permission and moving the generated Turbopack cache aside, a clean build passed. No project configuration changes were required.

Production browser checks cover login/signup labels and layout at all four widths, all protected workspace redirects, and existing signed-out discovery/outreach API checks. The fixture checks cover profile save/analyze, discovery/search/research/save, duplicate handling, rate-limit feedback and retry, pending controls, scoring, source selection, contact capture, draft generation/edit/save, submit/reject/revise/return-to-draft/approve, revision payloads, and manual-send cancellation/confirmation.

The feature screenshots and workflow checks use synthetic examples and mocked responses. They do **not** establish that live Supabase data, authenticated database writes, or paid OpenAI/Tavily integrations worked end to end. Those need a dedicated test account and live-service verification. The gated RLS integration test was not enabled. No paid AI or search requests were made. Accessibility checks cover native semantics, labels, focus, dialog behavior, and responsive layout; a full assistive-technology audit remains a separate check.

## Reproduce

Run the normal checks:

```sh
npm run lint
npx tsc --noEmit
npx vitest run --exclude 'tests/e2e/**'
npm run build
```

For production auth/responsive smoke tests, start `npm run start -- --hostname 127.0.0.1`, then run the existing Playwright configuration in another terminal.

For the synthetic feature workflow checks, use a **development** server, `npm run dev -- --hostname 127.0.0.1`, then run:

```sh
node scripts/verify-ui.mjs
```

The script refuses to overwrite an existing `src/app/ui-review` directory. It temporarily installs the synthetic fixture as a local preview route, intercepts every `/api/` request, saves screenshots, and removes the temporary route in its cleanup handler. It should only be used locally; no preview route is part of the delivered production build.

## Files changed

Modified:

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/discover/page.tsx`
- `src/app/qualification/page.tsx`
- `src/app/outreach/page.tsx`
- `src/components/layout/sign-out-button.tsx`
- `src/components/profile/profile-editor.tsx`
- `src/components/discover/discover-workspace.tsx`
- `src/components/qualification/workspace.tsx`
- `src/components/outreach/studio.tsx`

Added:

- `src/components/layout/app-shell.tsx`
- `src/components/ui/primitives.tsx`
- `src/components/dashboard/overview.tsx`
- `tests/e2e/ui.spec.ts`
- `tests/fixtures/ui-preview.tsx`
- `scripts/verify-ui.mjs`
- `docs/ui-modernization.md`
- `artifacts/ui/fixture-results.json`
- Screenshot files listed below.

## Final screenshots

Login screenshots show the actual application. All dashboard and feature screenshots use clearly synthetic fixture data; the running application continues to use its existing Supabase queries. Developer controls are hidden in the images. These are final screenshots, not before/after comparisons.

- [dashboard-1024.png](../artifacts/ui/dashboard-1024.png)
- [dashboard-1440.png](../artifacts/ui/dashboard-1440.png)
- [dashboard-375.png](../artifacts/ui/dashboard-375.png)
- [dashboard-768.png](../artifacts/ui/dashboard-768.png)
- [discover-1024.png](../artifacts/ui/discover-1024.png)
- [discover-1440.png](../artifacts/ui/discover-1440.png)
- [discover-375.png](../artifacts/ui/discover-375.png)
- [discover-768.png](../artifacts/ui/discover-768.png)
- [discovery-research-1440.png](../artifacts/ui/discovery-research-1440.png)
- [discovery-research-375.png](../artifacts/ui/discovery-research-375.png)
- [login-1440.png](../artifacts/ui/login-1440.png)
- [login-375.png](../artifacts/ui/login-375.png)
- [outreach-1024.png](../artifacts/ui/outreach-1024.png)
- [outreach-1440.png](../artifacts/ui/outreach-1440.png)
- [outreach-375.png](../artifacts/ui/outreach-375.png)
- [outreach-768.png](../artifacts/ui/outreach-768.png)
- [profile-1024.png](../artifacts/ui/profile-1024.png)
- [profile-1440.png](../artifacts/ui/profile-1440.png)
- [profile-375.png](../artifacts/ui/profile-375.png)
- [profile-768.png](../artifacts/ui/profile-768.png)
- [profile-analysis-1440.png](../artifacts/ui/profile-analysis-1440.png)
- [profile-analysis-375.png](../artifacts/ui/profile-analysis-375.png)
- [qualification-1024.png](../artifacts/ui/qualification-1024.png)
- [qualification-1440.png](../artifacts/ui/qualification-1440.png)
- [qualification-375.png](../artifacts/ui/qualification-375.png)
- [qualification-768.png](../artifacts/ui/qualification-768.png)
- [qualification-score-1440.png](../artifacts/ui/qualification-score-1440.png)
- [qualification-score-375.png](../artifacts/ui/qualification-score-375.png)

## Follow-up recommendations

- Run authenticated smoke checks with a dedicated Supabase test account, including dashboard counts and the gated two-user RLS suite.
- Consider a separate, authorized API change to expose safe saved personalization facts, research context, and last-updated timestamps in Outreach. The existing draft endpoint does not provide these fields, so this UI does not fabricate them.
- Add an unsaved-draft navigation confirmation and a searchable saved-draft list as workflow refinements.
- Perform a screen-reader and high-zoom audit with representative long research results.
