import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
// Run against a LOCAL development server only. The temporary route contains synthetic data.
const previewDirectory = path.resolve("src/app/ui-review");
if (fs.existsSync(previewDirectory))
  throw new Error("Refusing to overwrite an existing ui-review route.");
fs.mkdirSync(previewDirectory);
fs.copyFileSync(new URL("../tests/fixtures/ui-preview.tsx", import.meta.url), path.join(previewDirectory, "page.tsx"));
fs.mkdirSync("artifacts/ui", { recursive: true });
let browser;
const companyId = '019abbaa-1111-7111-8111-aaaaaaaaaaaa';
let saveConflict = false;
let searchFailure = false;
let pauseSearch = false;
let releaseSearch;
let screenshotCount = 0;
let draft = { id: '019abbaa-3333-7333-8333-aaaaaaaaaaaa', company_id: companyId, contact_id: null, channel: 'email', message_type: 'initial', subject: 'A website conversation', body: 'Hi Alex, I offer website development for consulting businesses. Would a brief conversation be useful?', status: 'draft', revision: 1, created_at: '2026-11-20T12:00:00Z' };
const assessment = { score: 78, confidence: 'medium', reasoning: 'The saved source mentions consulting services, which align with your website development offering. Current website needs are not confirmed.', positive_signals: ['Services align with your professional experience.'], risks: ['Budget and current priorities are unknown.'], evidence_indexes: [0], suggested_roles: [{ title: 'Operations Director', rationale: 'May oversee website vendor selection; verify responsibility.' }] };
const analysis = { positioning_statement: 'Website development for professional service teams.', verified_strengths: ['React and TypeScript experience supplied in the profile.'], suggested_services: ['Website development'], ideal_clients: [{ industry: 'Consulting', buyer_role: 'Operations Director', why_relevant: 'Professional service websites align with your offering.' }], missing_information: ['Add relevant project outcomes.'], cautions: ['Confirm all recommendations before offering services.'] };
const source = { title: 'Evergreen Consulting services', url: 'https://example.com/services', finding: 'Consulting services for professional businesses.' };
const report = { company: { name: 'Evergreen Consulting', website: 'https://example.com', industry: 'Consulting', location: 'Texas' }, sources: [source], research: { summary: 'A consulting business serving professional clients.', potential_opportunity: 'A website conversation may be relevant; no current need is confirmed.', relevance_to_profile: 'Website development aligns with the saved professional services.', confidence: 'medium', evidence_indexes: [0], caveats: ['Search snippets may be incomplete.'] } };
(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const calls = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
    errors.push(message.text()); });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    let data = {};
    let status = 200;
    if (path === '/api/discover/search' && pauseSearch)
      await new Promise(resolve => { releaseSearch = resolve; });
    if (path === '/api/profile/analyze')
      data = { analysis };
    else if (path === '/api/profile')
      data = { saved: true };
    else if (path === '/api/discover/search' && searchFailure) {
      status = 429;
      data = { error: 'Search rate limit reached. Please try again later.' };
    }
    else if (path === '/api/discover/search')
      data = { results: [{ title: 'Evergreen Consulting', url: 'https://example.com/services', snippet: 'Consulting services for professional businesses.' }] };
    else if (path === '/api/discover/research')
      data = report;
    else if (path === '/api/discover/save') {
      status = saveConflict ? 409 : 200;
      data = saveConflict ? { error: 'This company website is already saved', companyId } : { companyId };
    }
    else if (path === '/api/qualification/score')
      data = { assessment, sources: [{ id: 'source-1', url: source.url, finding: source.finding }] };
    else if (path === '/api/qualification/decision-makers')
      data = { results: [{ title: 'Leadership team', url: 'https://example.com/team', snippet: 'Review the company leadership team.' }], warning: 'Search candidates require verification.' };
    else if (path === '/api/qualification/contacts')
      data = { saved: true };
    else if (path === '/api/outreach/generate') {
      draft = { ...draft, status: 'draft' };
      data = { draft, cautions: ['Verify the current contact role before outreach.'] };
    }
    else if (path === '/api/outreach/drafts')
      data = { drafts: [draft] };
    else if (path.startsWith('/api/outreach/drafts/')) {
      const payload = route.request().postDataJSON();
      expect(payload.revision).toBe(draft.revision);
      if (payload.action === 'sent')
        expect(payload.confirmedManualSend).toBe(true);
      if (payload.action)
        draft = { ...draft, status: ({ submit: 'in_review', approve: 'approved', reject: 'rejected', revise: 'draft', sent: 'manually_sent' })[payload.action], revision: draft.revision + 1 };
      else
        draft = { ...draft, body: payload.body, subject: payload.subject, revision: draft.revision + 1 };
      data = { draft };
    }
    else {
      status = 500;
      data = { error: 'Unexpected mock request' };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://127.0.0.1:3000/ui-review');
  await page.addStyleTag({ content: 'nextjs-portal { display:none !important; }' });
  async function captureDetail(name) {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('[aria-label="Preview controls"]').evaluate(el => el.style.visibility = 'hidden');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/ui/${name}-${width}.png`, fullPage: true });
      screenshotCount++;
      await page.locator('[aria-label="Preview controls"]').evaluate(el => el.style.visibility = 'visible');
    }
  }
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Profile saved');
  await page.getByRole('button', { name: 'Analyze with Scout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your profile analysis', exact: true })).toBeVisible();
  await captureDetail('profile-analysis');
  await page.getByRole('button', { name: 'discover', exact: true }).click();
  await page.getByRole('button', { name: 'Search companies', exact: true }).click();
  await expect(page.getByText('Discovered candidate', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use as candidate' }).click();
  await page.getByRole('button', { name: 'Research this company' }).click();
  await expect(page.getByText('Research complete · Review required')).toBeVisible();
  await page.getByRole('button', { name: 'Save company and evidence' }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  await captureDetail('discovery-research');
  saveConflict = true;
  await page.getByRole('button', { name: 'Research this company' }).click();
  await page.getByRole('button', { name: 'Save company and evidence' }).click();
  await expect(page.getByText('Previously saved company')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Already saved' })).toBeDisabled();
  searchFailure = true;
  await page.getByRole('button', { name: 'Search companies', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('rate limit');
  searchFailure = false;
  pauseSearch = true;
  await page.getByRole('button', { name: 'Search companies', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Searching...' })).toBeDisabled();
  await expect.poll(() => typeof releaseSearch).toBe('function');
  releaseSearch();
  pauseSearch = false;
  await expect(page.getByText('Discovered candidate', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'qualification', exact: true }).click();
  await page.getByRole('button', { name: 'Score company with Scout' }).click();
  await expect(page.getByText('Qualified lead', { exact: true })).toBeVisible();
  await captureDetail('qualification-score');
  await page.getByRole('button', { name: 'Search leadership sources' }).click();
  await page.getByRole('button', { name: 'Use source link below' }).click();
  await expect(page.getByLabel('Source URL', { exact: true })).toHaveValue('https://example.com/team');
  await page.getByLabel('Full name', { exact: true }).fill('Alex Morgan');
  await page.getByLabel('Current job title', { exact: true }).fill('Operations Director');
  await page.getByRole('button', { name: 'Save contact candidate' }).click();
  await expect(page.getByRole('status')).toContainText('Contact candidate saved');
  await page.getByRole('button', { name: 'outreach', exact: true }).click();
  await page.getByRole('button', { name: 'Generate draft with Scout' }).click();
  const message = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(message).toBeVisible();
  await message.fill(draft.body + ' Thank you.');
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save edits' }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.getByRole('button', { name: 'Revise rejected draft' }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('button', { name: 'Return to draft' }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(message).toBeDisabled();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Mark manually sent' }).click();
  expect(draft.status).toBe('approved');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Mark manually sent' }).click();
  await expect(page.getByRole('status')).toContainText('No message was transmitted');
  expect(draft.status).toBe('manually_sent');
  // Keep a reviewable draft selected for visual inspection.
  draft = { ...draft, status: 'draft' };
  await page.getByRole('button', { name: 'Generate draft with Scout' }).click();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['dashboard', 'profile', 'discover', 'qualification', 'outreach']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      if (view === 'outreach') {
        await page.getByRole('button', { name: /Evergreen Consultingemail/ }).click();
      }
      await page.locator('[aria-label="Preview controls"]').evaluate(el => el.style.visibility = 'hidden');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/ui/${view}-${width}.png`, fullPage: true });
      screenshotCount++;
      await page.locator('[aria-label="Preview controls"]').evaluate(el => el.style.visibility = 'visible');
    }
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('http://127.0.0.1:3000/login');
  await page.addStyleTag({ content: 'nextjs-portal {visibility:hidden}' });
  await page.screenshot({ path: 'artifacts/ui/login-375.png', fullPage: true });
  screenshotCount++;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/ui/login-1440.png', fullPage: true });
  screenshotCount++;
  console.log(JSON.stringify({ result: 'passed', viewports: [375, 768, 1024, 1440], screenshots: screenshotCount, mockedRequests: calls.length, browserErrors: errors }, null, 2));
  fs.writeFileSync('artifacts/ui/fixture-results.json', JSON.stringify({ passed: errors.length === 0, viewports: [375, 768, 1024, 1440], screenshots: screenshotCount, mockedRequests: calls.length, browserErrors: errors }, null, 2));
  if (errors.length)
    throw new Error("Browser errors were recorded");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  fs.unlinkSync(path.join(previewDirectory, "page.tsx"));
  fs.rmdirSync(previewDirectory);
});
