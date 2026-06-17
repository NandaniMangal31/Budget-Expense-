import { createContext, useState, useEffect, useCallback, useMemo } from "react";
import API from "../services/api"; // Assuming this is your axios instance

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Safe lazy initializer for User
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser && savedUser !== "undefined" ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("User storage parse error on initialization:", e);
      return null;
    }
  });

  // Safe lazy initializer for Token
  const [token, setToken] = useState(() => {
    try {
      const savedToken = localStorage.getItem("token");
      return savedToken && savedToken !== "undefined" ? savedToken : null;
    } catch (e) {
      console.error("Token storage parse error on initialization:", e);
      return null;
    }
  });

  // Automatically sync token with Axios defaults whenever it changes
  useEffect(() => {
    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete API.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Sanity-check stored auth values on mount, clear if incomplete or invalid
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("token");
      const isUserValid = savedUser && savedUser !== "undefined";
      const isTokenValid = savedToken && savedToken !== "undefined";

      if (!isUserValid || !isTokenValid) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
      }
    } catch (storageError) {
      console.warn("Auth storage sanity check failed:", storageError);
      try {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      } catch {}
      setUser(null);
      setToken(null);
    }
  }, []);

  // Memoized login to prevent downstream re-renders
  const login = useCallback((authData) => {
    if (!authData?.token) {
      console.error("Auth Data is missing critical token configuration.");
      return;
    }

    const { token: newToken, user: userData } = authData;

    try {
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (storageError) {
      console.warn("Storage write restricted (e.g., Private Browsing mode). Falling back to memory state:", storageError);
    }

    // Always update React state, even if localStorage fails
    setToken(newToken);
    setUser(userData);
  }, []);

  // Memoized logout
  const logout = useCallback(() => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.clear(); // Safe clean-up
    } catch (e) {
      console.error("Clear storage error:", e);
    }
    setUser(null);
    setToken(null);
  }, []);

  // Memoize the value object so listeners don't re-render unless values actually change
  const contextValue = useMemo(() => ({
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token
  }), [user, token, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};