import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  registerUser,
  verifyEmailRequest,
  loginUser,
  fetchCurrentUser,
  adminLoginRequest,
  adminLogoutRequest,
} from "../services/authService.js";

const AuthContext = createContext(null);

const TOKEN_KEY = "mediTrust_token";
const USER_KEY = "mediTrust_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [initializing, setInitializing] = useState(true);

  const persistSession = useCallback((nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Log the user out if any API call comes back 401 (see services/api.js interceptor).
  useEffect(() => {
    window.addEventListener("mediTrust:unauthorized", clearSession);
    return () =>
      window.removeEventListener("mediTrust:unauthorized", clearSession);
  }, [clearSession]);

  // On first load, if we have a token, quietly confirm it's still valid.
  // This will fail with a network error until the backend exists (Phase 5) —
  // that's fine, we just keep trusting the locally stored session until then.
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const data = await fetchCurrentUser();
        if (!cancelled) setUser(data.user);
      } catch {
        // Backend not reachable yet, or token genuinely invalid (handled by
        // the 401 interceptor above). Either way, don't crash the app.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const data = await loginUser({ email, password });
      persistSession(data.token, data.user);
      return data.user;
    },
    [persistSession],
  );

  const adminLogin = useCallback(
    async ({ email, password }) => {
      const data = await adminLoginRequest({ email, password });
      persistSession(data.token, data.user);
      return data.user;
    },
    [persistSession],
  );

  // Registration no longer logs the user in: the account must first be confirmed with
  // the emailed code (verifyEmail), which is what issues the session token.
  const register = useCallback(
    async ({ name, email, password }) => registerUser({ name, email, password }),
    [],
  );

  const verifyEmail = useCallback(
    async ({ email, otp }) => {
      const data = await verifyEmailRequest({ email, otp });
      persistSession(data.token, data.user);
      return data.user;
    },
    [persistSession],
  );

  const logout = useCallback(() => {
    // Record admin logouts in the audit trail (best effort) before dropping the token.
    if (user?.role === "admin") adminLogoutRequest();
    clearSession();
  }, [clearSession, user]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === "admin",
      initializing,
      login,
      adminLogin,
      register,
      verifyEmail,
      logout,
    }),
    [user, token, initializing, login, adminLogin, register, verifyEmail, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
