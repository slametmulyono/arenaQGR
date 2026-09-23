import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qgr_user')) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('qgr_token', data.token);
      localStorage.setItem('qgr_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('qgr_token');
    localStorage.removeItem('qgr_user');
    setUser(null);
  }, []);

  // Segarkan profil saat aplikasi dimuat (mendapat detail rumah utk warga)
  useEffect(() => {
    if (!localStorage.getItem('qgr_token')) return;
    api.get('/auth/me')
      .then(({ data }) => {
        const fresh = data.user;
        localStorage.setItem('qgr_user', JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => { /* token invalid → interceptor menangani */ });
  }, []);

  // Sinkronkan antar-tab
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'qgr_user') {
        try { setUser(JSON.parse(e.newValue)); } catch { setUser(null); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** Rute beranda default sesuai peran */
export function homeFor(role) {
  if (role === 'warga') return '/m';
  if (role === 'satpam') return '/gate';
  return '/app';
}
