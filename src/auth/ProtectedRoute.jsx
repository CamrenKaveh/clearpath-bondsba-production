/**
 * ProtectedRoute Component
 *
 * Wrapper component for routes that require authentication.
 * Shows loading state while checking auth, redirects to login if not authenticated.
 * Supports role-based access control (Phase 1 TODO).
 *
 * Usage:
 * <ProtectedRoute requiredRole="underwriter">
 *   <MyAuthenticatedComponent />
 * </ProtectedRoute>
 */

import React from 'react';
import { useAuth } from './useAuth';
import { LoginPage } from './LoginPage';

export function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, loading, user } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a2540] to-[#1b3a6b] flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto" />
          <p className="text-white text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // TODO: Phase 1 - Implement role-based access control
  // if (requiredRole && !hasRequiredRole(user, requiredRole)) {
  //   return <UnauthorizedPage />;
  // }

  return children;
}
