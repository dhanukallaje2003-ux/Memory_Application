import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, type AuthUser } from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  try {
    const response = await api.refreshToken(refreshToken);
    storeTokens(response.accessToken, response.refreshToken);
    return response.accessToken;
  } catch (error) {
    // If refresh fails, clear tokens
    clearTokens();
    return null;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const { accessToken } = getStoredTokens();

      if (accessToken) {
        try {
          const response = await api.getCurrentUser();
          persistUser(response.user);
          setIsReady(true);
          return;
        } catch {
          // Fall through to refresh handling below.
        }
      }

      const { refreshToken } = getStoredTokens();
      if (refreshToken) {
        try {
          const newAccessToken = await refreshAccessToken();
          if (newAccessToken) {
            const response = await api.getCurrentUser();
            persistUser(response.user);
            setIsReady(true);
            return;
          }
        } catch {
          clearTokens();
        }
      }

      persistUser(null);
      setIsReady(true);
    };

    void initializeAuth();
  }, []);

  const persistUser = (nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      login: async (email: string, password: string) => {
        const response = await api.login({ email, password });
        storeTokens(response.accessToken, response.refreshToken);
        persistUser(response.user);
        return response.user;
      },
      register: async (name: string, email: string, password: string) => {
        const response = await api.register({ name, email, password });
        storeTokens(response.accessToken, response.refreshToken);
        persistUser(response.user);
        return response.user;
      },
      logout: () => {
        clearTokens();
        persistUser(null);
      },
    }),
    [isReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
