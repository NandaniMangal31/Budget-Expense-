import { createContext, useState, useMemo, useEffect } from "react";
import jwtDecode from "jwt-decode";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser && savedUser !== "undefined" ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      const savedToken = localStorage.getItem("token");
      if (savedToken && savedToken !== "undefined") {
        const { exp } = jwtDecode(savedToken);
        if (Date.now() >= exp * 1000) {
          localStorage.removeItem("token");
          return null;
        }
        return savedToken;
      }
      return null;
    } catch {
      return null;
    }
  });

  // 🔄 Auto logout when token expires
  useEffect(() => {
    if (token) {
      const { exp } = jwtDecode(token);
      const timeout = exp * 1000 - Date.now();
      if (timeout > 0) {
        const timer = setTimeout(() => logout(), timeout);
        return () => clearTimeout(timer);
      } else {
        logout();
      }
    }
  }, [token]);

  const login = (authData) => {
    if (!authData?.token) return;
    const { token, user: userData } = authData;
    try {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (e) {
      console.error("Storage error:", e);
    }
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch (e) {
      console.error("Clear storage error:", e);
    }
    setUser(null);
    setToken(null);
  };

  const value = useMemo(() => ({ user, token, login, logout }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
