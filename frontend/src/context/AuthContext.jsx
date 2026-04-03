import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setAuthToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("swi_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("swi_token"));

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem("swi_token", token);
    } else {
      localStorage.removeItem("swi_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("swi_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("swi_user");
    }
  }, [user]);

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    setUser(data.user);
    setToken(data.token);
    sessionStorage.setItem("swi_auth_flash", "Account created successfully.");
  };

  const login = async (payload) => {
    const { data } = await authApi.login(payload);
    setUser(data.user);
    setToken(data.token);
    sessionStorage.setItem("swi_auth_flash", "Successfully logged in.");
  };

  const logout = () => {
    sessionStorage.setItem("swi_auth_flash", "Logged out successfully.");
    setUser(null);
    setToken(null);
    setAuthToken(null);
  };

  const value = useMemo(
    () => ({ user, token, register, login, logout, isAuthenticated: Boolean(token) }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
