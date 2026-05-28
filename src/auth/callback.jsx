/**
 * Unified auth callback page.
 *
 * Handles:
 * - Google OAuth PKCE redirects (`?code=...`)
 * - Email confirmations / invites / magic links (`token_hash`, access tokens)
 * - Password recovery callbacks
 * - Explicit auth error parameters
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from './useAuth';

const SUCCESS_REDIRECT_DELAY_MS = 1200;
const FAILURE_REDIRECT_DELAY_MS = 3500;
const SESSION_POLL_ATTEMPTS = 6;
const SESSION_POLL_INTERVAL_MS = 150;

const EMAIL_VERIFY_TYPES = new Set(['signup', 'email', 'magiclink', 'invite', 'email_change']);

function readHashParams() {
  if (typeof window === 'undefined' || !window.location.hash) {
    return new URLSearchParams();
  }

  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(rawHash);
}

function readAuthReturnState() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = readHashParams();

  const readValue = (key) => params.get(key) || hashParams.get(key);

  return {
    params,
    hashParams,
    code: params.get('code'),
    errorCode: readValue('error_code') || readValue('error'),
    errorDescription: readValue('error_description'),
    accessToken: readValue('access_token'),
    refreshToken: readValue('refresh_token'),
    tokenHash: readValue('token_hash'),
    type: params.get('type') || hashParams.get('type'),
  };
}

function getFriendlyStatusCopy(type) {
  if (type === 'recovery') {
    return {
      title: 'Password recovery link ready',
      description: 'Your recovery link is valid. We are finishing sign-in now.',
    };
  }

  if (EMAIL_VERIFY_TYPES.has(type)) {
    return {
      title: 'Verification complete',
      description: 'Your email link is valid. We are finishing sign-in now.',
    };
  }

  return {
    title: 'Signing you in...',
    description: 'Exchanging authorization code for session',
  };
}

async function waitForPersistedSession(supabaseClient) {
  for (let attempt = 0; attempt < SESSION_POLL_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (data?.session) {
      return data.session;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, SESSION_POLL_INTERVAL_MS);
    });
  }

  throw new Error('Authentication completed, but the session was not ready yet. Please try again.');
}

export function OAuthCallback() {
  const [status, setStatus] = useState('exchanging');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(getFriendlyStatusCopy(undefined));
  const { user, loading, supabaseClient } = useAuth();
  const hasExchangedRef = useRef(false);
  const redirectTimerRef = useRef(null);
  const authReturnState = useMemo(() => readAuthReturnState(), []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (status === 'error') {
      return;
    }

    setStatus('success');
    redirectTimerRef.current = window.setTimeout(() => {
      window.location.replace('/');
    }, SUCCESS_REDIRECT_DELAY_MS);
  }, [loading, status, user]);

  useEffect(() => {
    if (!supabaseClient || hasExchangedRef.current) {
      return;
    }

    const {
      code,
      errorCode,
      errorDescription,
      accessToken,
      refreshToken,
      tokenHash,
      type,
      hashParams,
      params,
    } = authReturnState;

    if (errorCode) {
      hasExchangedRef.current = true;
      setStatus('error');
      setError(errorDescription || errorCode || 'Unknown OAuth error');
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.replace('/');
      }, FAILURE_REDIRECT_DELAY_MS);
      return;
    }

    if (user) {
      hasExchangedRef.current = true;
      return;
    }

    const copy = getFriendlyStatusCopy(type);
    setMessage(copy);

    const finalizeError = (nextError) => {
      setStatus('error');
      setError(nextError?.message || String(nextError) || 'Authentication failed');
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.replace('/');
      }, FAILURE_REDIRECT_DELAY_MS);
    };

    const finalizeSuccess = async () => {
      await waitForPersistedSession(supabaseClient);
      setStatus('success');
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.replace('/');
      }, SUCCESS_REDIRECT_DELAY_MS);
    };

    const clearCallbackArtifacts = () => {
      const nextUrl = new URL(window.location.href);
      ['code', 'type', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code', 'error_description']
        .forEach((key) => nextUrl.searchParams.delete(key));
      nextUrl.hash = '';
      window.history.replaceState(window.history.state, '', nextUrl.toString());
    };

    const completeCallback = async () => {
      hasExchangedRef.current = true;

      try {
        if (code) {
          const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
          clearCallbackArtifacts();
          await finalizeSuccess();
          return;
        }

        if (tokenHash && type) {
          const { error: verifyError } = await supabaseClient.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (verifyError) {
            throw verifyError;
          }
          clearCallbackArtifacts();
          await finalizeSuccess();
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            throw sessionError;
          }
          clearCallbackArtifacts();
          await finalizeSuccess();
          return;
        }

        if (type === 'recovery') {
          setStatus('recovery-ready');
          setMessage(copy);
          redirectTimerRef.current = window.setTimeout(() => {
            window.location.replace('/');
          }, SUCCESS_REDIRECT_DELAY_MS);
          return;
        }

        if (EMAIL_VERIFY_TYPES.has(type)) {
          setStatus('email-verified');
          setMessage(copy);
          redirectTimerRef.current = window.setTimeout(() => {
            window.location.replace('/');
          }, SUCCESS_REDIRECT_DELAY_MS);
          return;
        }

        if (params.toString() || hashParams.toString()) {
          throw new Error('Authentication callback did not include a supported session payload.');
        }

        setStatus('error');
        setError('Authentication callback is missing required parameters.');
      } catch (callbackError) {
        finalizeError(callbackError);
      }
    };

    completeCallback();
  }, [authReturnState, supabaseClient, user]);

  const heading = status === 'error' ? 'Authentication Failed' : message.title;
  const detail = status === 'error' ? error : message.description;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] to-[#1b3a6b] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {status === 'error' ? (
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
        ) : (
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-white">{heading}</h2>
          <p className={`${status === 'error' ? 'text-red-300' : 'text-slate-300'} text-sm`}>
            {detail}
          </p>

          {status === 'error' && (
            <p className="text-slate-400 text-xs font-mono text-left bg-red-900/30 p-3 rounded">
              {error}
            </p>
          )}

          <p className="text-slate-400 text-xs">
            {status === 'error' ? 'Redirecting to login...' : 'You will be redirected shortly.'}
          </p>

          <a
            href="/"
            className="inline-block mt-4 px-6 py-2 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0A2540] transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
