import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, permissions, settings }
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [expired, setExpired] = useState(false);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setSession(data);
    return data;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (tokenStore.get()) setExpired(true);
      tokenStore.set(null);
      setSession(null);
    });
    if (tokenStore.get()) {
      refresh()
        .catch(() => logout())
        .finally(() => setLoading(false));
    }
  }, [refresh, logout]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setExpired(false);
    setSession({ user: data.user, permissions: data.permissions, settings: data.settings });
    return data;
  }, []);

  const value = useMemo(() => {
    const permissions = session?.permissions || [];
    return {
      user: session?.user || null,
      permissions,
      settings: session?.settings || {},
      loading,
      expired,
      login,
      logout,
      refresh,
      /** can('a', 'b') → possui ao menos uma das permissões */
      can: (...perms) => perms.some((p) => permissions.includes(p)),
      setToken: (token) => tokenStore.set(token),
    };
  }, [session, loading, expired, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
