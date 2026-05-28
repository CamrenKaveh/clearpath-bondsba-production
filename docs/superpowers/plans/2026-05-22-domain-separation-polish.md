# Domain Separation Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the bondsba.com / clearpathsbaloan.com domain separation by fixing meta tags, domain-filtering nav items, and auditing mobile layout — then deploy to production.

**Architecture:** Single Vite+React SPA deployed on Vercel, serving two domains from one build. Domain identity is detected at runtime via `window.location.hostname`. `isClearpathDomain()` (exported from `src/App.jsx`) returns `true` on `clearpathsbaloan.com`. All domain-conditional rendering uses this function. No server-side splitting.

**Tech Stack:** React 18, Vite, Tailwind CSS v3, Lucide React icons, Vercel, GitHub (branch `feature/surety-api-improvements`)

---

## Context for all tasks

- Repo: `/Users/camre/clearpath`
- Working branch: `feature/surety-api-improvements`
- Two commits already landed: domain separation + design upgrade
- `isClearpathDomain()` is defined at ~line 729 of `src/App.jsx`
- `PAGE_CONFIG` is at ~line 423 of `src/App.jsx` — all titles say `| BondSBA`, need domain-aware override
- `BondHomeClassic` starts at ~line 3238 of `src/App.jsx`
- `SBALaneHome` is in `src/components/LanePages.jsx` starting at ~line 233
- Nav rendering is in the `<header>` block starting at ~line 1222 of `src/App.jsx`
- The nav desktop item list is rendered around line 1290–1330 of `src/App.jsx`

---

## File Map

| File | What changes |
|------|-------------|
| `src/App.jsx` | Domain-aware document title patch, nav item filtering |
| `src/components/LanePages.jsx` | Mobile layout fixes on SBALaneHome cross-link section |
| `index.html` | Verify no stale meta tags pointing to wrong domain |

---

### Task 1: Domain-aware document title + meta description

**Why:** Every `PAGE_CONFIG` entry has `title: '... | BondSBA'`. When users land on `clearpathsbaloan.com`, the browser tab and OG cards say "BondSBA" — wrong brand. Fix by patching the title string at the point it's written to `document.title`.

**Files:**
- Modify: `src/App.jsx` — the `useEffect` or function that writes `document.title` from `PAGE_CONFIG`

- [ ] **Step 1: Find where document.title is set from PAGE_CONFIG**

```bash
grep -n "document.title\|config.title\|PAGE_CONFIG\[" src/App.jsx | head -20
```

Expected output: a `useEffect` or function around line 870–900 that does `document.title = config.title`.

- [ ] **Step 2: Add a `resolveTitleForDomain` helper right above where document.title is set**

Find the exact line. The helper replaces `| BondSBA` with `| ClearPath SBA` and `— BondSBA` with `— ClearPath SBA` when on the clearpath domain:

```javascript
function resolveTitleForDomain(title) {
  if (!isClearpathDomain()) return title;
  return title
    .replace('| BondSBA', '| ClearPath SBA')
    .replace('— BondSBA', '— ClearPath SBA')
    .replace('BondSBA Terminal', 'ClearPath SBA');
}
```

Place this function definition immediately above `BondHomeClassic` (around line 3236) alongside the other utility functions.

- [ ] **Step 3: Apply the helper wherever document.title is written**

In the `useEffect` (or wherever `document.title = config.title` appears), wrap it:

```javascript
// Before:
document.title = config.title;

// After:
document.title = resolveTitleForDomain(config.title);
```

Run this to verify you found every assignment:
```bash
grep -n "document\.title\s*=" src/App.jsx
```
Apply `resolveTitleForDomain(...)` to every match.

- [ ] **Step 4: Also patch the meta description tag**

In the same `useEffect`, find where `meta[name="description"]` is updated. Wrap with the same helper (it only rewrites brand name strings so it's safe for description copy too):

```javascript
// Find the line that looks like:
const descEl = document.querySelector('meta[name="description"]');
if (descEl) descEl.setAttribute('content', config.description);

// Change to:
if (descEl) descEl.setAttribute('content', resolveTitleForDomain(config.description));
```

- [ ] **Step 5: Build and verify no errors**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: domain-aware document title and meta description for clearpathsbaloan.com"
```

---

### Task 2: Filter nav items by domain

**Why:** On `clearpathsbaloan.com` (SBA domain), the top nav shows bond-side tools (WIP Guide, Readiness, etc.) — wrong. On `bondsba.com`, it shows SBA tools — also wrong. Each domain should show only its own nav items.

**Files:**
- Modify: `src/App.jsx` — the nav item list rendered inside `<header>`

- [ ] **Step 1: Locate the desktop nav item list**

```bash
grep -n "nav.*item\|navItem\|PAGE_CONFIG.*nav\|bond.*nav\|sba.*nav" src/App.jsx | head -20
```

Also read the header block:
```bash
sed -n '1280,1360p' src/App.jsx
```

Find the array or JSX block that maps over nav items and renders them as buttons/links.

- [ ] **Step 2: Understand the current nav structure**

The nav likely either: (a) renders all PAGE_CONFIG items, (b) has a hardcoded list, or (c) filters by `lane`. Read lines 1280–1360 to understand the exact pattern.

- [ ] **Step 3: Add domain filter to nav item rendering**

Once you've located the nav list, add a filter so:
- On `clearpathsbaloan.com` (`isClearpathDomain() === true`): only render items whose `pageId` starts with `sba` (e.g. `sbaHome`, `sbaEligibility`, `sbaDocumentChecklist`, `calculatorLanding`, `sba504`, `compare`)
- On `bondsba.com` (`isClearpathDomain() === false`): only render items whose `pageId` starts with `bond` or is domain-neutral (e.g. `bondHome`, `opsQueue`, `wipAnalyzer`, `readinessEngine`, `pricing`)

The exact implementation depends on the nav structure you find in Step 1. Examples:

**If nav is a hardcoded array:**
```javascript
const NAV_ITEMS_BOND = [
  { id: 'bondHome', label: 'Home' },
  { id: 'opsQueue', label: 'Workspace' },
  { id: 'wipAnalyzer', label: 'WIP Review' },
  { id: 'readinessEngine', label: 'Readiness' },
  { id: 'pricing', label: 'Pricing' },
];

const NAV_ITEMS_SBA = [
  { id: 'sbaHome', label: 'Home' },
  { id: 'screener', label: 'Eligibility' },
  { id: 'checklist', label: 'Documents' },
  { id: 'calculatorLanding', label: 'Calculator' },
  { id: 'sba504', label: 'SBA 504' },
];

// In the nav render:
const navItems = isClearpathDomain() ? NAV_ITEMS_SBA : NAV_ITEMS_BOND;
```

**If nav is filtered dynamically from PAGE_CONFIG:**
```javascript
const SBA_PAGE_IDS = new Set(['sbaHome','sbaGuaranty','sbaEligibility','sbaDocumentChecklist','sbaLoanReadiness','sbaLenderPacket','screener','checklist','calculatorLanding','sba504','compare']);
const BOND_PAGE_IDS = new Set(['bondHome','bondWipAnalysis','bondReadiness','bondSubmissionChecklist','bondSuretyPacket','opsQueue','wipAnalyzer','readinessEngine','pricing']);

const allowedIds = isClearpathDomain() ? SBA_PAGE_IDS : BOND_PAGE_IDS;
// Then filter the existing nav items with: .filter(item => allowedIds.has(item.id))
```

- [ ] **Step 4: Apply the same filter to the mobile menu**

```bash
grep -n "mobile.*menu\|mobileMenu\|menuOpen" src/App.jsx | head -10
```

Find the mobile drawer/menu and apply the same `navItems` variable or filter there.

- [ ] **Step 5: Build and verify**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs` — no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: filter nav items by domain — bond tools only on bondsba.com, SBA only on clearpathsbaloan.com"
```

---

### Task 3: Mobile layout audit + fixes

**Why:** Both pages were built desktop-first. The bond hero has a two-panel grid (`lg:grid-cols-[1fr_1.1fr]`) that stacks fine, but the embedded `ContractorFileInputPanel` on mobile may overflow. The SBA cross-link callout on mobile has `flex-wrap` but the navy CTA button needs clearance.

**Files:**
- Modify: `src/App.jsx` — `BondHomeClassic` hero section (line ~3261)
- Modify: `src/components/LanePages.jsx` — `SBALaneHome` cross-link section

- [ ] **Step 1: Read the BondHomeClassic hero section**

```bash
sed -n '3261,3310p' src/App.jsx
```

Check: does the file check panel have `overflow-hidden` or `min-w-0` so it can't overflow the viewport on mobile? Does the hero section have horizontal padding on mobile?

- [ ] **Step 2: Fix BondHomeClassic hero mobile containment**

The hero section currently is:
```jsx
<section className="grid gap-8 rounded-2xl border ... lg:grid-cols-[1fr_1.1fr] lg:p-10">
```

Ensure the right panel (file check card) doesn't overflow on small screens. Find the file check card wrapper:
```jsx
<div className="rounded-xl border border-white/10 bg-white/[0.07] p-1 backdrop-blur-sm">
```

Add `overflow-hidden min-w-0` to that wrapper:
```jsx
<div className="overflow-hidden min-w-0 rounded-xl border border-white/10 bg-white/[0.07] p-1 backdrop-blur-sm">
```

Also ensure the inner white card has `overflow-x-auto` so the file prep inputs scroll horizontally if needed on very small screens:
```jsx
<div className="overflow-x-auto rounded-lg bg-white p-4">
```

- [ ] **Step 3: Fix BondHomeClassic pricing list mobile**

Find the pricing section. The divide-y list rows use `flex items-center gap-4 px-4 py-3`. On narrow screens (375px) the price + badge on the right might crowd the tier name. Add `flex-wrap` and ensure the price stays readable:

```jsx
// Find each pricing row:
<div key={name} className={`flex items-center gap-4 px-4 py-3 ${rec ? 'bg-[#0B1F3A]' : 'bg-white'}`}>

// Change to:
<div key={name} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${rec ? 'bg-[#0B1F3A]' : 'bg-white'}`}>
```

- [ ] **Step 4: Fix SBALaneHome cross-link callout mobile**

Read the cross-link section:
```bash
grep -n "Cross-link\|bondsba.com\|surety bond file" src/components/LanePages.jsx
```

The callout has a flex layout with an icon/text block and a CTA button. On mobile the button should stack below the text. Add `sm:flex-row flex-col` to the outer flex wrapper if not already present:

```jsx
// Find the flex container inside the callout (not the header row):
// Change from items-center to items-start, ensure it wraps:
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
```

If the structure already uses `flex-wrap`, verify the button has `w-full sm:w-auto` so it fills width on mobile.

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/LanePages.jsx
git commit -m "fix: mobile layout — hero panel overflow, pricing row wrap, SBA callout stacking"
```

---

### Task 4: Deploy to production

**Why:** All work is on `feature/surety-api-improvements`. It needs to be pushed, merged to main, and deployed via Vercel so `bondsba.com` and `clearpathsbaloan.com` reflect the domain separation.

**Files:**
- No source file changes — git + Vercel operations only.

- [ ] **Step 1: Push the feature branch**

```bash
git push origin feature/surety-api-improvements
```

Expected: branch pushed, no conflicts.

- [ ] **Step 2: Check if there's a main/master branch to merge into**

```bash
git branch -r | grep -E "main|master"
```

Note the default branch name (likely `main`).

- [ ] **Step 3: Create a PR or merge directly**

If the project uses PRs:
```bash
gh pr create \
  --title "feat: domain separation — bondsba.com (bond) / clearpathsbaloan.com (SBA)" \
  --body "$(cat <<'EOF'
## Summary
- bondsba.com now exclusively serves bond/surety content (BondHomeClassic, navy design system)
- clearpathsbaloan.com now exclusively serves SBA content (SBALaneHome, powered by BondSBA)
- Removed client-side JS redirect in index.html that was overwriting domain separation
- Domain-aware document titles, nav filtering, and cross-domain links connecting both properties
- IBM Plex Sans (bond) + Plus Jakarta Sans (SBA) font system applied
- Design upgrades: trust signals as divide-y list, USP table with Lucide icons, pricing as list

## Test plan
- [ ] Visit bondsba.com — should show navy bond hero, bond nav items only
- [ ] Visit clearpathsbaloan.com — should show SBA 3-step flow, SBA nav items only, BondSBA cross-link prominent
- [ ] Mobile: both pages layout correctly at 375px
- [ ] Browser tab shows correct brand per domain

🤖 Generated with Claude Code
EOF
)"
```

If direct merge is preferred:
```bash
git checkout main && git merge feature/surety-api-improvements && git push origin main
```

- [ ] **Step 4: Verify Vercel auto-deploys or trigger manually**

```bash
# Check if Vercel CLI is available:
which vercel || npx vercel --version

# If connected to Vercel, check deploy status:
npx vercel ls 2>/dev/null | head -5
```

If Vercel is connected to the GitHub repo, pushing to main triggers auto-deploy. Otherwise:
```bash
npx vercel --prod
```

- [ ] **Step 5: Smoke test production**

After deploy completes (usually 1-3 minutes), verify:
```bash
# Bond side — should return 200 with BondSBA branding
curl -sI https://bondsba.com | grep -E "HTTP|location"

# SBA side — should return 200, NOT redirect to bondsba.com
curl -sI https://clearpathsbaloan.com | grep -E "HTTP|location"
```

Expected:
- `bondsba.com` → `HTTP/2 200`
- `clearpathsbaloan.com` → `HTTP/2 200` (not a redirect)

If `clearpathsbaloan.com` still redirects, check Vercel project settings → Domains and ensure both domains point to the same project.
