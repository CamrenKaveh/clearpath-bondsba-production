import { useState, useEffect } from 'react';

export const ADSENSE_CLIENT = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT || 'ca-pub-1746307224219740';
export const AD_SLOTS = {
  top:            import.meta.env.VITE_ADSENSE_SLOT_TOP_BANNER     || import.meta.env.VITE_ADSENSE_SLOT_TOP || 'PENDING',
  bottom:         import.meta.env.VITE_ADSENSE_SLOT_BOTTOM         || 'PENDING',
  inFeed:         import.meta.env.VITE_ADSENSE_SLOT_IN_FEED        || 'PENDING',
  sidebar:        import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR        || 'PENDING',
  tool:           import.meta.env.VITE_ADSENSE_SLOT_TOOL           || 'PENDING',
  landingTop:     import.meta.env.VITE_ADSENSE_SLOT_LANDING_TOP    || 'PENDING',
  landingMid:     import.meta.env.VITE_ADSENSE_SLOT_LANDING_MID    || 'PENDING',
  landingBottom:  import.meta.env.VITE_ADSENSE_SLOT_LANDING_BOTTOM || 'PENDING',
  landingSidebar: import.meta.env.VITE_ADSENSE_SLOT_LANDING_SIDEBAR || 'PENDING',
};
const AD_SLOT_FALLBACKS = {
  top:     'landingTop',
  bottom:  'landingBottom',
  inFeed:  'landingMid',
  sidebar: 'landingSidebar',
  tool:    'landingBottom',
};

const CLEARPATH_HOSTS = ['clearpathsbaloan', 'clearpathsba'];

const isClearpathDomain = () =>
  typeof window !== 'undefined' && CLEARPATH_HOSTS.some((host) => window.location.hostname.includes(host));

// Cookie name per site — avoids cross-domain bleed in shared browser profiles.
export const CONSENT_COOKIE_NAME = isClearpathDomain() ? 'clearpath_ad_consent' : 'bondsba_ad_consent';
export const ADSENSE_STORAGE_KEY = isClearpathDomain() ? 'clearpath-ad-consent' : 'bondsba-ad-consent';
const ADSENSE_AUTO_ADS_FLAG = isClearpathDomain() ? '__clearpathAutoAdsInitialized' : '__bondsbaAutoAdsInitialized';

// ── Cookie helpers ────────────────────────────────────────────────────────────
// Consent cookies last 1 year, path=/, SameSite=Lax.
// No "Secure" flag here — JS can't set Secure on non-HTTPS (localhost),
// and Vercel serves HTTPS so the browser enforces it anyway.

export function getConsentCookie() {
  if (typeof document === 'undefined') return 'unknown';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(CONSENT_COOKIE_NAME + '='));
  if (match) return decodeURIComponent(match.split('=')[1]);
  try {
    return window.localStorage.getItem(ADSENSE_STORAGE_KEY) || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function setConsentCookie(value) {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  try {
    window.localStorage.setItem(ADSENSE_STORAGE_KEY, value);
  } catch {
    // Cookie persistence is the canonical path; localStorage is compatibility.
  }
}

// Keep the old name exported so existing callers in App.jsx don't break.
export const getStoredAdConsent = getConsentCookie;

// ── AdSense helpers ───────────────────────────────────────────────────────────

export function loadAdSenseScript(client) {
  if (!client || typeof document === 'undefined') return;
  if (document.querySelector('script[data-bondsba-adsense="true"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.bondsbaAdsense = 'true';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

export function configureAutoAds(client, consent) {
  if (!client || typeof window === 'undefined') return;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.requestNonPersonalizedAds = consent === 'accepted' ? 0 : 1;
  if (window[ADSENSE_AUTO_ADS_FLAG]) return;
  try {
    window.adsbygoogle.push({ google_ad_client: client, enable_page_level_ads: true });
    window[ADSENSE_AUTO_ADS_FLAG] = true;
  } catch {
    // AdSense can throw during hot reload before the script is fully ready.
  }
}

function trackAdImpression(placement, slotId) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'ad_impression', placement, slotId: slotId || 'auto' });
}

// ── AdSenseSlot ───────────────────────────────────────────────────────────────

export function AdSenseSlot({ placement, className = '', compact = false }) {
  const rawSlot = AD_SLOTS[placement] || AD_SLOTS[AD_SLOT_FALLBACKS[placement]] || 'PENDING';
  const isPending = rawSlot === 'PENDING';
  const slotId = isPending ? '' : rawSlot;

  const [consent, setConsent] = useState(() => getConsentCookie());
  const hasAdSense = Boolean(ADSENSE_CLIENT);
  const consentAllowsAds = consent === 'accepted' || consent === 'rejected';
  const isReady = consentAllowsAds && hasAdSense && !isPending;

  useEffect(() => {
    // Listen for the custom event fired by AdConsentBanner after writing the cookie.
    const handleConsentChange = () => setConsent(getConsentCookie());
    window.addEventListener('ad-consent-updated', handleConsentChange);
    window.addEventListener('storage', handleConsentChange);
    return () => {
      window.removeEventListener('ad-consent-updated', handleConsentChange);
      window.removeEventListener('storage', handleConsentChange);
    };
  }, []);

  useEffect(() => {
    if (!consentAllowsAds || !hasAdSense) return;
    loadAdSenseScript(ADSENSE_CLIENT);
    configureAutoAds(ADSENSE_CLIENT, consent);
    if (isPending) return;
    window.adsbygoogle = window.adsbygoogle || [];
    trackAdImpression(placement, slotId || 'auto');
    try {
      window.adsbygoogle.push({});
    } catch {
      // AdSense can reject duplicate pushes during hot reload; the slot still reserves space.
    }
  }, [consent, consentAllowsAds, hasAdSense, isReady, isPending, placement, slotId]);

  // Keep a clean reserved area when explicit slot IDs are not configured.
  // Auto Ads can still load after consent; avoid exposing implementation details.
  if (isPending) {
    return (
      <aside
        data-ad-placement={placement}
        className={`bondsba-ad-slot border border-dashed border-slate-300 bg-white/70 text-slate-500 ${compact ? 'min-h-20' : 'min-h-28'} flex flex-col items-center justify-center px-4 py-3 text-center ${className}`}
        aria-label="Advertisement"
      >
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Advertisement</span>
        <span className="mt-1 text-xs text-slate-500">
          {consentAllowsAds ? 'Ads help keep these tools free.' : 'Accept cookies to load ads.'}
        </span>
      </aside>
    );
  }

  return (
    <aside
      data-ad-placement={placement}
      className={`bondsba-ad-slot border border-dashed border-slate-300 bg-white/80 text-slate-500 ${compact ? 'min-h-20' : 'min-h-28'} ${className}`}
      aria-label="Advertisement"
    >
      {isReady ? (
        <ins
          className="adsbygoogle block w-full min-h-[90px]"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT}
          {...(slotId ? { 'data-ad-slot': slotId } : {})}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="h-full min-h-[inherit] flex flex-col items-center justify-center px-4 py-3 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Advertisement</span>
          <span className="mt-1 text-xs text-slate-500">
            {consent === 'rejected'
              ? 'Contextual ads load automatically.'
              : 'Accept cookies to load personalized ads.'}
          </span>
        </div>
      )}
    </aside>
  );
}

export default AdSenseSlot;
