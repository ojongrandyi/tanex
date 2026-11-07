// Who is signed in to the console and what they may do (docs/IAM_RBAC_SPEC.md §9).
// Loads GET /api/auth/session once per page load. The server stays the authority: this only
// decides what the console shows, so a hidden button never replaces a server-side check.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type SessionUser } from '../services/api';
import { hasPermission, type PermissionKey } from '../shared/permissions';

export type { SessionUser };

interface AuthContextValue {
  /** False until the first session check has answered (or failed). */
  ready: boolean;
  user: SessionUser | null;
  /** The server can email a reset link, so the sign-in screen may offer "Forgot password?". */
  passwordReset: boolean;
  /** True when the signed-in user holds the key (or '*'). Always false when signed out. */
  can: (key: PermissionKey) => boolean;
  /** True when the user holds at least one of the keys. */
  canAny: (...keys: PermissionKey[]) => boolean;
  /** Reads the session again (after sign-in or a password change). */
  refresh: () => Promise<SessionUser | null>;
  /** Replaces the user after an update the server already answered with (My account). */
  setUser: (user: SessionUser | null) => void;
  /** Signs out, then reloads so no data loaded for this user stays in memory. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [passwordReset, setPasswordReset] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const session = await api.getSession();
      setUser(session.user);
      setPasswordReset(session.passwordReset);
      return session.user;
    } catch {
      // Server unreachable: treat as signed out; signing in reports the connection problem.
      setUser(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      window.location.reload();
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const granted = user?.permissions ?? [];
    const can = (key: PermissionKey) => hasPermission(granted, key);
    return {
      ready,
      user,
      passwordReset,
      can,
      canAny: (...keys) => keys.some(can),
      refresh,
      setUser,
      logout
    };
  }, [ready, user, passwordReset, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** True when the signed-in user holds `key`. */
export function usePermission(key: PermissionKey): boolean {
  return useAuth().can(key);
}

/**
 * Renders its children only for users holding the permission (any of them when given a list).
 * `fallback` is shown otherwise (nothing by default).
 */
export const Can: React.FC<{
  permission: PermissionKey | readonly PermissionKey[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permission, fallback = null, children }) => {
  const { canAny } = useAuth();
  const keys = (Array.isArray(permission) ? permission : [permission]) as PermissionKey[];
  return <>{canAny(...keys) ? children : fallback}</>;
};
