/**
 * EmbeddedCheckoutPage
 *
 * Replaces the redirect-to-Stripe-Checkout flow with an in-page Stripe Elements
 * Payment Element. Server creates a Subscription with trial + SetupIntent;
 * we collect the card with Elements; user lands on /billing/success without
 * leaving bondsba.com.
 */
import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { getAuthToken } from '../shared/utils/supabaseClient';
import { PLAN_CATALOG } from '../shared/billing/plans';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

function fmtPrice(plan, interval) {
  const p = PLAN_CATALOG[plan];
  if (!p) return '';
  const price = interval === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
  return `$${price}/${interval === 'yearly' ? 'yr' : 'mo'}`;
}

function CheckoutForm({ plan, interval, trialDays }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing/success?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval)}&trial=1`,
      },
    });
    if (confirmError) {
      setError(confirmError.message || 'Card could not be saved. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: { type: 'tabs', defaultCollapsed: false } }} />
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[#0B1F3A] px-5 text-[14px] font-semibold text-white hover:bg-[#12365F] disabled:opacity-60"
      >
        {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving card…</>) : `Start ${trialDays}-day free trial`}
      </button>
      <p className="text-[12px] text-slate-500">
        No charge today. After {trialDays} days you'll be charged {fmtPrice(plan, interval)}. Cancel anytime in account settings — no charge if cancelled before day {trialDays}.
      </p>
    </form>
  );
}

export function EmbeddedCheckoutPage({ nav, user, onRequireAuth }) {
  const params = new URLSearchParams(window.location.search);
  const plan = params.get('plan') || 'professional';
  const interval = params.get('interval') || 'monthly';
  const [clientSecret, setClientSecret] = useState('');
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!PUBLISHABLE_KEY) {
      setError('Stripe publishable key is not configured. Contact support.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken().catch(() => null);
        if (!token) {
          onRequireAuth?.('Sign in to start your free trial.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/stripe/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan, interval }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          onRequireAuth?.('Sign in to start your free trial.');
          setLoading(false);
          return;
        }
        if (!res.ok || !data.clientSecret) {
          setError(data.detail || data.error?.message || data.error || 'Could not start checkout.');
          setLoading(false);
          return;
        }
        setClientSecret(data.clientSecret);
        setTrialDays(data.trialDays || 14);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not start checkout.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [plan, interval, onRequireAuth]);

  const planInfo = PLAN_CATALOG[plan] || PLAN_CATALOG.professional;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        {/* Left — trial summary */}
        <div>
          <button onClick={() => nav('pricing')} className="text-[12px] text-slate-500 hover:text-slate-900">← Back to plans</button>
          <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[32px]">Start your {trialDays}-day free trial</h1>
          <p className="mt-3 text-[15px] text-slate-600">
            We'll save your card so we can charge automatically when the trial ends. No charge before day {trialDays}.
          </p>

          <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Plan</p>
            <p className="mt-1 text-[17px] font-semibold text-slate-900">{planInfo.name}</p>
            <p className="mt-0.5 text-[13px] text-slate-500">{planInfo.bestFor}</p>
            <div className="mt-4 border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-[13px]">
              <p className="text-slate-500">Today</p>
              <p className="text-right tabular-nums font-semibold text-slate-900">$0.00</p>
              <p className="text-slate-500">After {trialDays}-day trial</p>
              <p className="text-right tabular-nums font-semibold text-slate-900">{fmtPrice(plan, interval)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-[12px] text-slate-500">
            <p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Card secured by Stripe. We never see card numbers.</p>
            <p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Cancel anytime in account settings.</p>
            <p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Sign-up does not commit you beyond the trial.</p>
          </div>
        </div>

        {/* Right — Stripe Elements */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_18px_38px_-12px_rgba(15,23,42,0.18)] md:p-7">
          {loading && (
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing checkout…
            </div>
          )}
          {!loading && error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && clientSecret && stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#0B1F3A',
                    colorBackground: '#ffffff',
                    colorText: '#0f172a',
                    colorDanger: '#b91c1c',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <CheckoutForm plan={plan} interval={interval} trialDays={trialDays} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
