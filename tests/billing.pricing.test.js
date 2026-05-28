import { assert, runTests } from './setup.js';
import {
  getCheckoutMode,
  getPriceId,
  isSupportedPaidPlan,
} from '../lib/billing/pricing.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

const tests = {
  'Billing: rejects unknown and quote-based plan keys instead of silently checking out Starter': async () => {
    assert.falsy(isSupportedPaidPlan('enterprise'), 'Enterprise must remain quote-based');
    assert.falsy(isSupportedPaidPlan('file_prep_pilot'), 'Legacy file_prep_pilot key should not normalize to Starter');
    assert.falsy(isSupportedPaidPlan('totally_unknown'), 'Unknown plans should not normalize to Starter');
  },

  'Billing: accepts only self-serve paid checkout plans': async () => {
    assert.truthy(isSupportedPaidPlan('starter'), 'Starter should be supported');
    assert.truthy(isSupportedPaidPlan('professional'), 'Professional should be supported');
    assert.truthy(isSupportedPaidPlan('operations'), 'Operations should be supported');
    assert.truthy(isSupportedPaidPlan('pilot'), 'Pilot should be supported');
    assert.falsy(isSupportedPaidPlan('solo'), 'Solo is hidden until Stripe prices are configured');
  },

  'Billing: resolves Stripe prices only for known plans': async () => {
    resetEnv();
    process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter_monthly';
    process.env.STRIPE_PRICE_FILE_PREP_PILOT = 'price_pilot';

    assert.equal(getPriceId('starter', 'monthly'), 'price_starter_monthly', 'Starter monthly price should resolve');
    assert.equal(getPriceId('pilot', 'monthly'), 'price_pilot', 'Pilot price should resolve');
    assert.equal(getPriceId('enterprise', 'monthly'), null, 'Enterprise should not resolve a self-serve price');
    assert.equal(getPriceId('file_prep_pilot', 'monthly'), null, 'Legacy file_prep_pilot should not resolve a starter price');
  },

  'Billing: pilot uses one-time payment and subscriptions stay recurring': async () => {
    assert.equal(getCheckoutMode('pilot'), 'payment', 'Pilot should use one-time checkout');
    assert.equal(getCheckoutMode('starter'), 'subscription', 'Starter should use subscription checkout');
  },
};

runTests(tests).then(({ failed }) => {
  resetEnv();
  process.exit(failed > 0 ? 1 : 0);
});
