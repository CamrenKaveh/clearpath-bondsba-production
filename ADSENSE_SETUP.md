# AdSense Setup Guide

Publisher ID: `ca-pub-1746307224219740`

---

## How ads work on this project

This app serves two domains from one build:

- **clearpathsbaloan.com** — fully free, ads always shown to all users
- **bondsba.com** — ads shown to free / unauthenticated users; Pro users see no ads

### Auto-ads (active right now, no extra config needed)

The AdSense script tag in `index.html` loads with your publisher ID:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1746307224219740" crossorigin="anonymous"></script>
```

As long as AdSense has approved your sites, auto-ads will fill available placements automatically — no slot IDs required. The `AdSenseSlot` component in `src/App.jsx` also calls `enable_page_level_ads: true` on load, which reinforces auto-ads.

**Auto-ads are the default fallback.** If you never set any slot ID env vars, ads will still run via auto-ads wherever AdSense decides to place them.

---

## Adding your sites to AdSense (required for approval)

Both domains must be added to your AdSense account before ads will render:

1. Go to [adsense.google.com](https://adsense.google.com)
2. Click **Sites** in the left sidebar
3. Click **Add site**
4. Enter `clearpathsbaloan.com` → follow the verification steps
5. Repeat for `bondsba.com`

AdSense approval for a new site typically takes **1–3 days** after adding. Ads will not display until the site is approved.

---

## Optional: explicit ad unit slot IDs

Explicit slot IDs let you control exactly where specific ad units appear and track their performance separately in the AdSense dashboard.

### How to create a slot ID

1. Go to [adsense.google.com](https://adsense.google.com)
2. Click **Ads** → **By ad unit** → **Display ads**
3. Give the unit a name (e.g. "ClearPath Top Banner")
4. Click **Create** — AdSense shows you a snippet like `data-ad-slot="1234567890"`
5. Copy the 10-digit slot ID

### Env var names

Add these in the Vercel dashboard under **Project → Settings → Environment Variables** (apply to Production + Preview):

| Env var | Placement in the app |
|---|---|
| `VITE_ADSENSE_SLOT_TOP` | Top of page / above content |
| `VITE_ADSENSE_SLOT_BOTTOM` | Bottom of page / below content |
| `VITE_ADSENSE_SLOT_IN_FEED` | In-feed / between list items |
| `VITE_ADSENSE_SLOT_SIDEBAR` | Sidebar |
| `VITE_ADSENSE_SLOT_TOOL` | Inside tool pages |
| `VITE_ADSENSE_SLOT_LANDING_TOP` | Landing page — top |
| `VITE_ADSENSE_SLOT_LANDING_MID` | Landing page — middle |
| `VITE_ADSENSE_SLOT_LANDING_BOTTOM` | Landing page — bottom |
| `VITE_ADSENSE_SLOT_LANDING_SIDEBAR` | Landing page — sidebar |

If a slot ID is not set, the component renders an `<ins>` element without `data-ad-slot`, which AdSense auto-ads will fill. No placement is left blank.

The publisher client ID (`ca-pub-1746307224219740`) is hardcoded in `src/App.jsx` as the default for `VITE_GOOGLE_ADSENSE_CLIENT`, so you do not need to set that env var unless you want to override it.

---

## CSP headers

`vercel.json` already includes all required AdSense domains in the Content-Security-Policy header:

- **script-src**: `pagead2.googlesyndication.com`, `partner.googleadservices.com`, `ep2.adtrafficquality.google`, `tpc.googlesyndication.com`
- **frame-src**: `googleads.g.doubleclick.net`, `tpc.googlesyndication.com`, `www.google.com`, `ep2.adtrafficquality.google`
- **connect-src**: `pagead2.googlesyndication.com`, `adservice.google.com`, `www.googletagservices.com`

No further CSP changes are needed.

---

## Checklist before ads go live

- [ ] Both `clearpathsbaloan.com` and `bondsba.com` added to AdSense → Sites
- [ ] Sites approved by AdSense (1–3 days)
- [ ] (Optional) Slot IDs created and added as Vercel env vars
- [ ] Redeploy on Vercel after adding env vars
