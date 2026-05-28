/**
 * useAuth Hook
 *
 * Provides access to authentication state and methods.
 * Use this hook in any component that needs user info, session management, or auth methods.
 *
 * Example:
 * const { user, isAuthenticated, loading, signOut } = useAuth();
 */

import { useContext } from 'react';
import { AuthContext } from './AuthProvider';

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
