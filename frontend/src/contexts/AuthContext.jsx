import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

const TOKEN_KEY = "utbis_token";

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.me()
      .then((u) => setUser(u))
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({ id: data.user_id, email, display_name: data.display_name ?? "" });
    return data;
  }

  async function register(email, password, displayName) {
    const data = await api.register(email, password, displayName);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({ id: data.user_id, email, display_name: displayName });
    return data;
  }

  async function logout() {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
