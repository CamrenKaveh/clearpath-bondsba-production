/**
 * Auth and user-touchpoint regression tests.
 *
 * These intentionally cover the wiring that broke Google OAuth return state,
 * default API access for new users, Cloudflare verification placement, and the
 * WIP analyzer's ability to accept new user-entered jobs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assert, runTests } from './setup.js';
import { buildAuthenticatedUser } from '../lib/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const tests = {
  'Auth: new Google users get underwriter access to SBA and surety APIs': async () => {
    const user = buildAuthenticatedUser({
      id: 'user-123',
      email: 'analyst@example.com',
      user_metadata: {},
    });

    assert.equal(user.userRole, 'underwriter', 'Default role should run analyzer APIs');
    assert.truthy(user.metadata.domains.includes('sba'), 'Default domains should include SBA');
    assert.truthy(user.metadata.domains.includes('surety'), 'Default domains should include surety');
  },

  'Auth: app router wraps OAuth callback and profile consumers in AuthProvider': async () => {
    const source = read('src/AppRouter.jsx');

    assert.truthy(source.includes("from './auth/AuthProvider'"), 'Router should import AuthProvider');
    assert.truthy(source.includes('<AuthProvider>'), 'Router content should be inside AuthProvider');
  },

  'Auth: app router accepts OAuth callback routes with or without a trailing slash': async () => {
    const source = read('src/AppRouter.jsx');

    assert.truthy(source.includes("path.replace(/\\/+$/, '')"), 'Router should normalize trailing slashes on callback routes');
    assert.truthy(source.includes("normalizedPath === '/auth/callback'"), 'Router should recognize the OAuth callback route after normalization');
  },

  'Auth: provider uses the shared Supabase client that API token helpers read from': async () => {
    const source = read('src/auth/AuthProvider.jsx');
    const client = read('src/shared/utils/supabaseClient.js');

    assert.truthy(source.includes("from '../shared/utils/supabaseClient'"), 'AuthProvider should import the shared Supabase client');
    assert.truthy(!source.includes("from '@supabase/supabase-js'"), 'AuthProvider should not create a second browser client');
    assert.truthy(client.includes("flowType: 'pkce'"), 'Shared Supabase client should use PKCE for OAuth callback exchange');
    assert.truthy(client.includes('detectSessionInUrl: false'), 'Callback page should own the code exchange to avoid duplicate exchanges');
  },

  'Auth: provider canonicalizes auth redirects to bondsba.com before OAuth or email auth starts': async () => {
    const source = read('src/auth/AuthProvider.jsx');

    assert.truthy(source.includes('https://bondsba.com/auth/callback'), 'Auth redirects should target the canonical callback host');
    assert.truthy(source.includes('normalizeAuthHost'), 'AuthProvider should normalize non-canonical hosts before auth starts');
    assert.truthy(source.includes('window.location.replace('), 'Host normalization should perform a hard redirect before auth begins');
  },

  'Auth: callback page handles OAuth, email confirmation, and recovery states without re-exchanging forever': async () => {
    const source = read('src/auth/callback.jsx');

    assert.truthy(source.includes('hasExchangedRef'), 'Callback page should guard against duplicate PKCE exchanges');
    assert.truthy(source.includes("params.get('type')"), 'Callback page should inspect auth callback type');
    assert.truthy(source.includes('window.location.hash'), 'Callback page should inspect hash-based auth return state');
    assert.truthy(source.includes('waitForPersistedSession'), 'Callback page should wait for the browser session to persist before redirecting home');
    assert.truthy(source.includes('supabaseClient.auth.getSession()'), 'Callback page should actively confirm the exchanged session exists');
    assert.truthy(source.includes('Verification complete'), 'Callback page should show a user-friendly email confirmation success state');
    assert.truthy(source.includes('Password recovery link ready'), 'Callback page should show a user-friendly recovery state');
  },

  'Auth: client-side host redirect script leaves www.bondsba.com alone so PKCE verifier stays on one origin during callback': async () => {
    const source = read('index.html');

    assert.truthy(!source.includes("'www.bondsba.com': true"), 'index.html should not JS-redirect www.bondsba.com during callback handling');
  },

  'Auth: edge redirects canonicalize www.bondsba.com and legacy hosts before login starts': async () => {
    const source = read('vercel.json');

    assert.truthy(source.includes('"value": "www.bondsba.com"'), 'Vercel redirects should canonicalize the www host');
    assert.truthy(source.includes('"destination": "https://bondsba.com/:path*"'), 'Edge redirects should land on bondsba.com');
  },

  'Auth: sign-in page uses visible Cloudflare Turnstile verification': async () => {
    const source = read('src/auth/AuthModal.jsx');

    assert.truthy(source.includes('Turnstile'), 'Auth modal should show Cloudflare Turnstile');
    assert.truthy(source.includes('VITE_TURNSTILE_SITE_KEY'), 'Auth modal should use Turnstile site key');
    assert.truthy(!source.includes('grecaptcha'), 'Auth modal should not depend on Google reCAPTCHA');
  },

  'Auth: sign-in actions stay disabled until Cloudflare verification completes': async () => {
    const source = read('src/auth/AuthModal.jsx');
    const provider = read('src/auth/AuthProvider.jsx');

    assert.truthy(source.includes('const isVerificationReady = Boolean(turnstileToken);'), 'Auth modal should track Turnstile readiness');
    assert.truthy(source.includes('disabled={loading || !isVerificationReady}'), 'Auth buttons should require Cloudflare verification');
    assert.truthy(provider.includes('captchaToken,'), 'Supabase auth calls should receive the captcha token');
  },

  'WIP: analyzer exposes controls to enter new job data': async () => {
    const source = read('src/domains/surety/components/WIPAnalyzer.jsx');

    assert.truthy(source.includes('handleAddJob'), 'WIP analyzer should allow adding jobs');
    assert.truthy(source.includes('name="name"'), 'WIP analyzer should have a job name input');
    assert.truthy(source.includes('name="totalValue"'), 'WIP analyzer should have a contract value input');
    assert.truthy(source.includes('name="spent"'), 'WIP analyzer should have a costs-to-date input');
    assert.truthy(source.includes('name="earned"'), 'WIP analyzer should have an earned revenue input');
  },

  'WIP: analyzer starts with user-owned data entry instead of prefilled demo jobs': async () => {
    const source = read('src/domains/surety/components/WIPAnalyzer.jsx');

    assert.truthy(source.includes('const [jobs, setJobs] = useState([]);'), 'WIP analyzer should not load random sample jobs by default');
    assert.truthy(source.includes('Add Sample Jobs'), 'WIP analyzer may offer sample data only as an explicit action');
  },

  'Touchpoints: protected tool clicks open sign-in instead of dead unauthenticated APIs': async () => {
    const source = read('src/App.jsx');

    assert.truthy(source.includes('navWithAuth'), 'App should route protected tool clicks through an auth gate');
    assert.truthy(source.includes('setAuthOpen(true)'), 'Auth gate should open the sign-in/create-account modal');
    assert.truthy(source.includes("authPrompt"), 'App should show clear feedback after a protected click');
  },

  'Touchpoints: surety intent route keeps public landing and public dashboard preview': async () => {
    const source = read('src/App.jsx');
    const dashboardSource = read('src/domains/surety/components/SuretyDashboard.jsx');

    assert.truthy(source.includes("path: '/surety-underwriting'"), 'Public surety landing route should exist');
    assert.truthy(source.includes("path: '/surety-dashboard'"), 'Surety dashboard route should exist');
    assert.truthy(source.includes("new Set(['calculator', 'spreading', 'wip'])"), 'Dashboard preview should remain public while deeper analysis tools stay protected');
    assert.truthy(source.includes("<SEOLandingPage pageId=\"surety\""), 'Surety route should render a public landing page');
    assert.truthy(dashboardSource.includes('Preview mode: you can review the workflow layout now.'), 'Dashboard should present a signed-out preview state');
  },

  'Touchpoints: direct protected routes render the auth gate while signed out': async () => {
    const source = read('src/App.jsx');

    assert.truthy(source.includes('const pageRequiresAuth = protectedPages.has(page);'), 'App should detect protected pages after direct URL resolution');
    assert.truthy(source.includes('!loading && !user && pageRequiresAuth'), 'Direct protected routes should be gated after auth state loads');
    assert.truthy(source.includes('!pageRequiresAuth || user'), 'Protected workspace components should not render while signed out');
    assert.truthy(source.includes('Sign in or create an account to run BondSBA Terminal submission tools.'), 'Direct protected routes should show a clear account prompt');
  },
};

runTests(tests, 'Auth and Touchpoint Regression');
