import { createContext, useContext, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));

  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('session', JSON.stringify(data.session));
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }

  async function register(email, password, name) {
    const { data } = await api.post('/api/auth/register', { email, password, name });
    if (data.session) {
      localStorage.setItem('session', JSON.stringify(data.session));
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  }

  async function logout() {
    try { await api.post('/api/auth/logout'); } catch(_) {}
    localStorage.removeItem('session');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
