/**
 * AuthModal Component
 *
 * Sign in / create account flow with visible Cloudflare Turnstile verification,
 * Google OAuth, and manual email/password account entry.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { useAuth } from './useAuth';

const TURNSTILE_TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '3x00000000000000000000FF',
]);

function isLocalHost() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function TurnstileBox({ onVerify, onExpire }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const localHost = isLocalHost();

    // Local demo/testing should not block sign-in behind a domain-bound widget.
    if (localHost) {
      setStatus('dev-ready');
      onVerify('dev-turnstile-token');
      return undefined;
    }

    if (!siteKey) {
      if (import.meta.env.PROD) {
        setStatus('error');
        onExpire();
        return undefined;
      }
      setStatus('dev-ready');
      onVerify('dev-turnstile-token');
      return undefined;
    }

    if (import.meta.env.PROD && TURNSTILE_TEST_SITE_KEYS.has(siteKey)) {
      setStatus('prod-key-missing');
      onExpire();
      return undefined;
    }

    const renderTurnstile = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => {
          setStatus('verified');
          onVerify(token);
        },
        'expired-callback': () => {
          setStatus('expired');
          onExpire();
        },
        'error-callback': () => {
          setStatus('error');
          onExpire();
        },
      });
      setStatus('waiting');
    };

    if (window.turnstile) {
      renderTurnstile();
      return undefined;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderTurnstile;
    script.onerror = () => setStatus('error');
    document.head.appendChild(script);

    return () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onExpire, onVerify]);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Cloudflare verification</p>
          <p className="text-xs text-slate-600">Complete the checkbox before continuing.</p>
        </div>
        {status === 'verified' || status === 'dev-ready' ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-slate-500" />
        )}
      </div>
      <div className="mt-3 min-h-[65px]">
        <div ref={containerRef} className="cf-turnstile" />
        {status === 'loading' && (
          <div className="flex h-[65px] items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Cloudflare check...
          </div>
        )}
        {status === 'dev-ready' && (
          <div className="flex h-[65px] items-center rounded-sm border border-green-200 bg-white px-3 text-sm font-medium text-green-700">
            Local development verification ready
          </div>
        )}
        {status === 'expired' && (
          <p className="pt-2 text-xs font-medium text-amber-700">Verification expired. Check the box again.</p>
        )}
        {status === 'error' && (
          <p className="pt-2 text-xs font-medium text-red-700">Cloudflare could not load. Refresh and try again.</p>
        )}
        {status === 'prod-key-missing' && (
          <p className="pt-2 text-xs font-medium text-red-700">Cloudflare production key is not configured.</p>
        )}
      </div>
    </div>
  );
}

export function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth();
  const isVerificationReady = Boolean(turnstileToken);

  const resetError = () => setError(null);

  const requireTurnstile = () => {
    if (!turnstileToken) {
      setError('Complete the Cloudflare verification first.');
      return false;
    }
    return true;
  };

  const handleGoogleClick = useCallback(async () => {
    if (!requireTurnstile()) return;
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle(turnstileToken);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
      setLoading(false);
    }
  }, [signInWithGoogle, turnstileToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!requireTurnstile()) return;

    setLoading(true);
    setError(null);

    const action = mode === 'signin' ? signInWithPassword : signUpWithPassword;
    const { error: authError } = await action({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      captchaToken: turnstileToken,
    });

    setLoading(false);
    if (authError) {
      setError(authError.message || 'Authentication failed. Please try again.');
      return;
    }

    if (mode === 'signup') {
      setError('Account created. Check your email if confirmation is required, then sign in.');
      setMode('signin');
      return;
    }

    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'signin' ? 'Sign in to BondSBA Terminal' : 'Create your BondSBA account'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Access SBA, bond, WIP, and financing submission tools.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-sm p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close sign in"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-5 flex border-b border-slate-200">
          {[
            ['signin', 'Sign In'],
            ['signup', 'Create Account'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setMode(value);
                resetError();
              }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                mode === value
                  ? '-mb-px border-b-2 border-[#1B3A6B] text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <TurnstileBox
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken('')}
        />

        {error && (
          <div className={`mt-4 rounded-md border p-3 ${
            error.startsWith('Account created')
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <button
          onClick={handleGoogleClick}
          disabled={loading || !isVerificationReady}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {mode === 'signin' ? 'Sign In' : 'Create Account'} with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Full name
              </span>
              <input
                name="fullName"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">
              Email
            </span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">
              Password
            </span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading || !isVerificationReady}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-400 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In with Email' : 'Create Account with Email'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
