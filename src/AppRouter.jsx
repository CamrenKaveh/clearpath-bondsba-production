import React, { Suspense, lazy, useState, useEffect } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { initializeSuretyDB } from './domains/surety/db/suretyDatabase';
import { supabase } from './shared/utils/supabaseClient';
import { normalizeSupabaseUrl } from './shared/utils/supabaseConfig';

const App = lazy(() => import('./App'));
const OAuthCallback = lazy(() => import('./auth/callback').then((module) => ({ default: module.OAuthCallback })));

/**
 * Main Application Router
 * Routes between SBA Loan Processing and Surety Bond Underwriting
 */
export default function AppRouter() {
  const [currentPage, setCurrentPage] = useState('sba');
  const [supabaseReady, setSupabaseReady] = useState(false);

  // Initialize Supabase on mount
  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          initializeSuretyDB(supabase);
          setSupabaseReady(true);
        } else {
          console.warn('Supabase not configured. Database features will be disabled.');
          setSupabaseReady(false);
        }
      } catch (error) {
        console.warn('Supabase initialization failed:', error);
        setSupabaseReady(false);
      }
    };

    initializeSupabase();
  }, []);

  // Handle OAuth callback route
  useEffect(() => {
    const path = window.location.pathname;
    const normalizedPath = path.replace(/\/+$/, '') || '/';

    if (normalizedPath === '/auth/callback') {
      setCurrentPage('oauth-callback');
    }
  }, []);

  return (
    <AuthProvider>
      <RouterContent
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        supabaseReady={supabaseReady}
      />
    </AuthProvider>
  );
}

function RouterContent({
  currentPage,
  setCurrentPage,
  supabaseReady: _supabaseReady,
}) {
  const fallback = (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-700">
      Loading BondSBA workspace…
    </div>
  );

  return (
    <div className="bg-slate-50">
      <main className="min-h-screen">
        <Suspense fallback={fallback}>
          {currentPage === 'sba' && <App />}
          {currentPage === 'oauth-callback' && <OAuthCallback />}
        </Suspense>
      </main>
    </div>
  );
}
