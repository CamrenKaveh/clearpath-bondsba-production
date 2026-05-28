import { test, expect } from 'playwright/test';

// ── 1. Home page loads, H1 contains "kills a bond" ──────────────────────────
test('home page loads with expected H1', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1').first();
  await expect(h1).toContainText('kills a bond');
});

// ── 2. "Check a contractor file free" button is visible and the file check
//       form (contractor name input) is present on the home page ───────────────
test('check a contractor file free button and form visible on home', async ({ page }) => {
  await page.goto('/');
  // The button is in the hero section
  const btn = page.getByRole('button', { name: /check a contractor file free/i });
  await expect(btn).toBeVisible();

  // The ContractorFileInputPanel is rendered directly on the home page
  const nameInput = page.locator('input[placeholder="Northline Civil LLC"]').first();
  await expect(nameInput).toBeVisible();

  // Clicking the button stays on home (nav('home') is a no-op); form stays visible
  await btn.click();
  await expect(nameInput).toBeVisible();
});

// ── 3. Nav "Submission Workspace" navigates to ops queue ────────────────────
test('Workspace nav item loads the ops queue', async ({ page }) => {
  await page.goto('/');
  // NavLinks render as <a> elements in a <nav>
  const workspaceNav = page.getByRole('navigation').getByRole('link', { name: /^workspace$/i }).first();
  await workspaceNav.click();
  await expect(page.locator('h1').filter({ hasText: 'File Prep Workspace' })).toBeVisible({ timeout: 10000 });
});

// ── 4. File check form — fill name, change WIP, click Check File ──────────────
test('file check form fills and Check File navigates to readiness', async ({ page }) => {
  await page.goto('/');

  // Fill contractor name
  const nameInput = page.locator('input[placeholder="Northline Civil LLC"]').first();
  await nameInput.fill('Acme Builders LLC');

  // Change WIP schedule status to "received" (the segmented control)
  // SegmentedControl renders buttons for each option
  const receivedBtn = page.locator('button', { hasText: /^received$/i }).first();
  await receivedBtn.click();

  // Click Check File
  const checkFileBtn = page.getByRole('button', { name: /^check file$/i }).first();
  await checkFileBtn.click();

  // Should navigate to readiness engine page
  await expect(page.locator('h1').filter({ hasText: 'Submission Readiness' })).toBeVisible({ timeout: 10000 });
});

// ── 5. SBA Calculator landing page ──────────────────────────────────────────
//    The full /calculator is auth-protected. The public landing is at
//    /sba-7a-calculator. We verify that page loads with a visible heading.
test('SBA Calculator landing page loads', async ({ page }) => {
  await page.goto('/sba-7a-calculator');
  // The SEO landing page has an H1
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: 10000 });
  // The amortization schedule table is NOT on the landing page (it requires auth).
  // Verify the CTA button to open the full calculator is visible.
  const ctaBtn = page.getByRole('button', { name: /SBA (Loan |7.a )?Calculator|Open/i }).first();
  await expect(ctaBtn).toBeVisible();
});

// ── 6. Pricing page loads with at least one plan name ────────────────────────
test('pricing page loads with plan names visible', async ({ page }) => {
  await page.goto('/');
  // Click Pricing in the nav (NavLinks render as <a> elements)
  const pricingNav = page.getByRole('navigation').getByRole('link', { name: /^pricing$/i }).first();
  await pricingNav.click();
  // At least one of Starter or Professional plan label should be visible
  const planText = page.locator('text=/Starter|Professional/').first();
  await expect(planText).toBeVisible({ timeout: 10000 });
});

// ── 7. Footer has "BondSBA" text ──────────────────────────────────────────────
test('footer contains BondSBA text', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer).toContainText('BondSBA');
});
