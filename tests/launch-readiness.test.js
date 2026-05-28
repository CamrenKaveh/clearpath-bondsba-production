/**
 * Launch-readiness regression tests for production wiring.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assert, runTests } from './setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function extractJsonLdDocuments(html) {
  const documents = [];
  const pattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    documents.push(match[1].trim());
  }

  return documents;
}

const tests = {
  'API: AI endpoint allows BondSBA domain and requires auth': async () => {
    const source = read('api/ai.js');

    assert.truthy(source.includes('bondsba.com'), 'AI origin allow-list should include production domain');
    assert.truthy(source.includes('verifyAndAttachUser'), 'AI endpoint should verify Supabase auth');
  },

  'Client: AI requests attach Supabase bearer token': async () => {
    const source = read('src/App.jsx');

    assert.truthy(source.includes("const token = await getAuthToken().catch(() => null);"), 'fetchAI should read the current auth token');
    assert.truthy(source.includes("...(token ? { 'Authorization': `Bearer ${token}` } : {})"), 'fetchAI should attach Authorization header when signed in');
  },

  'API: surety process endpoint requires auth before analyzing contractor files': async () => {
    const source = read('api/v1/surety/process.js');

    assert.truthy(source.includes('const authError = await verifyAndAttachUser(req);'), 'Surety process endpoint should always verify Supabase auth');
    assert.truthy(!source.includes('if (req.headers.authorization)'), 'Surety process endpoint should not allow unauthenticated processing');
    assert.truthy(!source.includes('req.user?.userId'), 'Surety process endpoint should not return analysis without a user owner');
  },

  'Database: surety reference schema does not contain permissive RLS placeholders': async () => {
    const source = read('src/domains/surety/db/schema.sql');

    assert.truthy(!source.includes('USING (true)'), 'Surety reference schema should not include open SELECT/UPDATE policies');
    assert.truthy(!source.includes('WITH CHECK (true)'), 'Surety reference schema should not include open INSERT/UPDATE policies');
    assert.truthy(source.includes("created_by = auth.uid()::text"), 'Surety reference schema should scope applications to the authenticated owner');
  },

  'Auth: production cannot silently use Cloudflare Turnstile test keys': async () => {
    const source = read('src/auth/AuthModal.jsx');
    const verifier = read('api/v1/auth/verify-turnstile.js');

    assert.truthy(source.includes('TURNSTILE_TEST_SITE_KEYS'), 'Client should identify Turnstile test keys');
    assert.truthy(verifier.includes('TURNSTILE_TEST_SECRET_KEYS'), 'Server should identify Turnstile test secrets');
    assert.truthy(source.includes('Cloudflare production key is not configured'), 'Client should fail closed for test site keys in production');
    assert.truthy(verifier.includes('Cloudflare production secret is not configured'), 'Server should fail closed for test secrets in production');
  },

  'Auth: app uses one shared Supabase browser client': async () => {
    const source = read('src/AppRouter.jsx');

    assert.truthy(source.includes("from './shared/utils/supabaseClient'"), 'AppRouter should import the shared client');
    assert.truthy(!source.includes("await import('@supabase/supabase-js')"), 'AppRouter should not create a second browser client');
  },

  'Auth: server authorization does not trust user-editable metadata for roles': async () => {
    const source = read('lib/middleware/auth.js');

    assert.truthy(source.includes('user.app_metadata'), 'Authorization should read app metadata');
    assert.truthy(!source.includes("metadata.role || 'underwriter'"), 'Authorization should not read role from user metadata');
  },

  'SEO: metadata uses bondsba.com and no legacy clearpath.finance references': async () => {
    const source = read('index.html');
    const app = read('src/App.jsx');
    const sitemap = read('public/sitemap.xml');
    const vercel = read('vercel.json');
    const buildConfig = read('package.json');
    const staticReadiness = read('public/contractor-submission-readiness/index.html');
    const staticRequirements = read('public/sba-loan-requirements/index.html');
    const staticDocuments = read('public/sba-loan-documents/index.html');
    const staticCalculator = read('public/sba-7a-calculator-guide/index.html');
    const staticSurety = read('public/surety-underwriting/index.html');
    const static504 = read('public/sba-504-loans/index.html');
    const staticBonding = read('public/contractor-bonding/index.html');
    const staticOpsQueue = read('public/submission-ops-queue-guide/index.html');

    assert.truthy(source.includes('https://bondsba.com/'), 'Canonical metadata should use production domain');
    assert.truthy(source.includes('BondSBA Terminal'), 'Metadata should use the BondSBA Terminal brand');
    assert.truthy(source.includes('CollectionPage'), 'SEO metadata should include collection page structured data');
    assert.truthy(source.includes('contractor submission readiness'), 'Metadata should target the contractor submission readiness wedge');
    assert.truthy(!source.includes('clearpath.finance'), 'Metadata should not reference legacy domain');
    assert.truthy(app.includes('/contractor-submission-readiness'), 'App should expose a crawlable contractor readiness route');
    assert.truthy(app.includes('/sba-loan-requirements'), 'App should expose a crawlable SBA requirements route');
    assert.truthy(app.includes('/sba-loan-documents'), 'App should expose a crawlable SBA documents route');
    assert.truthy(app.includes('/sba-7a-calculator'), 'App should expose a crawlable SBA 7(a) landing route');
    assert.truthy(app.includes('/sba-loan-calculator'), 'App should expose a crawlable calculator route');
    assert.truthy(app.includes('/submission-ops-queue'), 'App should expose a crawlable submission ops queue route');
    assert.truthy(app.includes('/surety-underwriting'), 'App should expose a crawlable surety route');
    assert.truthy(app.includes('/sba-504-loans'), 'App should expose a crawlable SBA 504 route');
    assert.truthy(app.includes('/contractor-bonding'), 'App should expose a crawlable contractor bonding route');
    assert.truthy(buildConfig.includes('generate-seo-pages.mjs'), 'Build should generate static SEO landing pages before Vite bundles the SPA');
    assert.truthy(staticReadiness.includes('Contractor Submission Readiness'), 'Contractor readiness landing page should be pre-rendered');
    assert.truthy(staticRequirements.includes('SBA Loan Requirements Guide'), 'Requirements landing page should be pre-rendered');
    assert.truthy(staticDocuments.includes('SBA Loan Documents Checklist'), 'Document landing page should be pre-rendered');
    assert.truthy(staticCalculator.includes('SBA 7(a) Calculator Guide'), 'Calculator landing page should be pre-rendered');
    assert.truthy(staticSurety.includes('Surety Underwriting Guide'), 'Surety landing page should be pre-rendered');
    assert.truthy(static504.includes('SBA 504 Loans Guide'), 'SBA 504 landing page should be pre-rendered');
    assert.truthy(staticBonding.includes('Contractor Bonding Guide'), 'Contractor bonding landing page should be pre-rendered');
    assert.truthy(staticOpsQueue.includes('Submission Ops Queue'), 'Submission ops queue landing page should be pre-rendered');
    assert.truthy(source.includes('https://bondsba.com/sba-loan-documents'), 'Homepage schema should link to the crawlable SBA documents page');
    assert.truthy(source.includes('https://bondsba.com/sba-7a-calculator'), 'Homepage schema should link to the crawlable SBA 7(a) page');
    assert.truthy(!source.includes('https://bondsba.com/sba-loan-calculator"'), 'Homepage schema should not point crawlers to the auth-gated calculator workspace');
    assert.truthy(!source.includes('https://bondsba.com/sba-document-checklist"'), 'Homepage schema should not point crawlers to the checklist tool route');
    assert.truthy(sitemap.includes('https://bondsba.com/contractor-submission-readiness'), 'Sitemap should include the contractor readiness route');
    assert.truthy(sitemap.includes('https://bondsba.com/sba-loan-requirements'), 'Sitemap should include the SBA requirements route');
    assert.truthy(sitemap.includes('https://bondsba.com/sba-loan-documents'), 'Sitemap should include the SBA documents route');
    assert.truthy(sitemap.includes('https://bondsba.com/sba-7a-calculator-guide'), 'Sitemap should include the static SBA 7(a) calculator guide route');
    assert.truthy(sitemap.includes('https://bondsba.com/submission-ops-queue'), 'Sitemap should include the submission ops queue route');
    assert.truthy(!sitemap.includes('https://bondsba.com/sba-loan-calculator'), 'Sitemap should not include auth-gated calculator workspace route');
    assert.truthy(sitemap.includes('https://bondsba.com/surety-underwriting'), 'Sitemap should include the surety route');
    assert.truthy(sitemap.includes('https://bondsba.com/sba-504-loans'), 'Sitemap should include the SBA 504 route');
    assert.truthy(sitemap.includes('https://bondsba.com/contractor-bonding'), 'Sitemap should include the contractor bonding route');
    assert.truthy(!sitemap.includes('https://bondsba.com/surety-dashboard'), 'Sitemap should not include the private surety dashboard route');
    assert.truthy(!sitemap.includes('https://bondsba.com/financial-spreading'), 'Sitemap should not include protected tool routes that serve SPA fallback HTML');
    assert.truthy(!sitemap.includes('https://bondsba.com/wip-schedule-analyzer'), 'Sitemap should not include protected tool routes that serve SPA fallback HTML');
    assert.truthy(source.includes("'/financial-spreading'"), 'Root metadata script should still mark protected tool routes intentionally');
    assert.truthy(source.includes("robots: 'noindex, nofollow'"), 'Protected tool routes should be marked noindex for crawler-visible fallback metadata');
    assert.truthy(vercel.includes('"source": "/surety-dashboard"'), 'Protected dashboard should send crawler-visible noindex headers');
    assert.truthy(vercel.includes('"source": "/sba-loan-calculator"'), 'Protected calculator workspace should send crawler-visible noindex headers');
    assert.truthy(vercel.includes('"source": "/financial-spreading"'), 'Protected spreading tool should send crawler-visible noindex headers');
    assert.truthy(vercel.includes('"source": "/wip-schedule-analyzer"'), 'Protected WIP tool should send crawler-visible noindex headers');
    assert.truthy(vercel.includes('"key": "X-Robots-Tag"'), 'Protected routes should use X-Robots-Tag for non-JS crawlers');
  },

  'SEO: JSON-LD structured data parses on all crawlable static pages': async () => {
    const pages = [
      'index.html',
      'public/contractor-submission-readiness/index.html',
      'public/sba-loan-requirements/index.html',
      'public/sba-loan-documents/index.html',
      'public/sba-7a-calculator-guide/index.html',
      'public/submission-ops-queue-guide/index.html',
      'public/surety-underwriting/index.html',
      'public/sba-504-loans/index.html',
      'public/contractor-bonding/index.html',
    ];

    pages.forEach((file) => {
      const documents = extractJsonLdDocuments(read(file));
      assert.truthy(documents.length > 0, `${file} should include JSON-LD structured data`);
      documents.forEach((document, index) => {
        try {
          JSON.parse(document);
        } catch (error) {
          assert.truthy(false, `${file} JSON-LD #${index + 1} should parse: ${error.message}`);
        }
      });
    });
  },

  'Surety: public and protected surety surfaces sell triage value instead of placeholder workflow copy': async () => {
    const app = read('src/App.jsx');
    const dashboard = read('src/domains/surety/components/SuretyDashboard.jsx');
    const client = read('src/domains/surety/api/suretyClient.js');
    const readiness = read('src/domains/surety/components/ReadinessReport.jsx');
    const spreading = read('src/domains/surety/components/SpreadingEngine.jsx');
    const wip = read('src/domains/surety/components/WIPAnalyzer.jsx');
    const applicationsEndpoint = read('api/v1/surety/applications.js');

    assert.truthy(!app.includes('>Beta<'), 'Homepage surety section should not present as beta');
    assert.truthy(app.includes('Cleaner contractor submissions before underwriting.'), 'Homepage hero should emphasize cleaner submissions');
    assert.truthy(app.includes('Surety Triage Workspace'), 'Homepage surety card should frame the dashboard as a triage workspace');
    assert.truthy(app.includes('Open Triage Workspace'), 'Surety landing page should use the triage workspace CTA');
    assert.truthy(dashboard.includes('Surety Submission Triage Workspace'), 'Dashboard should clearly frame the surety workspace');
    assert.truthy(dashboard.includes('Submission Completeness'), 'Dashboard should show readiness-style cards instead of placeholder portfolio metrics');
    assert.truthy(dashboard.includes('What this workspace does differently'), 'Dashboard should explain the workflow wedge');
    assert.truthy(dashboard.includes('Review Sequence'), 'Dashboard should guide the surety team through an explicit review workflow');
    assert.truthy(dashboard.includes('Underwriter Handoff Checklist'), 'Dashboard should include a practical handoff checklist');
    assert.truthy(dashboard.includes('Recent Readiness Packets'), 'Dashboard should let users reopen saved readiness packets');
    assert.truthy(client.includes('listSavedApplications'), 'Surety client should support loading saved readiness packets');
    assert.truthy(applicationsEndpoint.includes('verifyAndAttachUser'), 'Saved readiness packets should be loaded through an authenticated endpoint');
    assert.truthy(readiness.includes('Submission Readiness Report'), 'Surety workflow should render a first-class readiness report');
    assert.truthy(readiness.includes('Underwriter Cover Memo'), 'Readiness workflow should produce sharable underwriter output');
    assert.truthy(spreading.includes('What this helps you catch'), 'Spreading engine should explain underwriting value');
    assert.truthy(spreading.includes('Underwriter Follow-Up'), 'Spreading engine should produce practical follow-up guidance');
    assert.truthy(wip.includes('What this helps you catch'), 'WIP analyzer should explain underwriting value');
    assert.truthy(wip.includes('Review Flags'), 'WIP analyzer should summarize first-pass review flags');
  },

  'Compliance: public launch files and legal pages exist': async () => {
    [
      'public/ads.txt',
      'public/robots.txt',
      'public/sitemap.xml',
      'public/manifest.webmanifest',
      'public/apple-touch-icon.png',
      'public/og-image.png',
      'public/bondsba-icon.svg',
      'public/bondsba-terminal-logo.png',
      'public/privacy',
      'public/terms',
    ].forEach((file) => assert.truthy(exists(file), `${file} should exist`));
  },

  'Privacy: reCAPTCHA scripts are not loaded globally and AdSense verification code is explicit': async () => {
    const source = read('index.html');
    const app = read('src/App.jsx');

    assert.truthy(source.includes('ca-pub-1746307224219740'), 'Homepage should expose the explicit AdSense verification client');
    assert.truthy(!source.includes('recaptcha/api.js'), 'reCAPTCHA script should be removed after Turnstile migration');
    assert.truthy(!exists('api/v1/auth/verify-recaptcha.js'), 'Old reCAPTCHA verification endpoint should be removed');
    assert.truthy(!exists('src/auth/OAuthDiagnostic.jsx'), 'Old reCAPTCHA diagnostic component should be removed');
    assert.truthy(!app.includes('SpeedInsights'), 'Analytics should not load before consent');
  },

  'Ads: AdSense inventory is reserved and consent-gated': async () => {
    const source = read('src/App.jsx');
    const privacy = read('public/privacy');
    const ads = read('public/ads.txt');

    assert.truthy(source.includes('AdConsentBanner'), 'App should show an advertising consent banner');
    assert.truthy(source.includes('bondsba-ad-consent'), 'Ad consent should persist locally');
    assert.truthy(source.includes('VITE_GOOGLE_ADSENSE_CLIENT'), 'AdSense client should be configured through Vercel env');
    assert.truthy(source.includes('enable_page_level_ads: true'), 'Auto ads should be enabled for sitewide monetization');
    assert.truthy(source.includes('requestNonPersonalizedAds'), 'Rejected personalization should still allow contextual ads');
    assert.truthy(source.includes('VITE_ADSENSE_SLOT_LANDING_TOP'), 'Landing-page ad slot envs should be wired');
    assert.truthy(source.includes('VITE_ADSENSE_SLOT_LANDING_SIDEBAR'), 'Landing-page sidebar ad slot env should be wired');
    assert.truthy(source.includes('data-ad-slot'), 'Ad inventory should reserve stable layout slots');
    assert.truthy(!source.includes('placement="tool"'), 'Core work surfaces should not embed tool-page ads');
    assert.truthy(privacy.includes('Google AdSense'), 'Privacy policy should disclose AdSense');
    assert.truthy(ads.includes('google.com, pub-'), 'ads.txt should declare the AdSense publisher');
  },

  'UX: eligibility screener has a real final result path': async () => {
    const source = read('src/App.jsx');

    assert.truthy(source.includes('onSubmit={advance}'), 'Last quiz step should submit the analysis');
    assert.truthy(source.includes('Get Final Result'), 'Final CTA should clearly promise a result');
    assert.truthy(source.includes('Readiness Score'), 'Result page should show a concrete score');
    assert.truthy(source.includes('Items Requiring Attention'), 'Result page should explain hard stops and conditions');
  },

  'UX: checklist export downloads a report instead of printing the screen': async () => {
    const source = read('src/App.jsx');

    assert.truthy(source.includes('const exportChecklist = () =>'), 'Checklist should have a dedicated export function');
    assert.truthy(source.includes('bondsba-terminal-document-checklist.html'), 'Checklist export should download a reusable file');
    assert.truthy(!source.includes('onClick={() => window.print()}'), 'Checklist export should not just open the print dialog');
    assert.truthy(source.includes('Download Report'), 'Checklist export button should describe the output');
  },
};

runTests(tests, 'Launch Readiness Regression');
