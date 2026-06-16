import { createContext, useState } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 🎯 REFRESH FIX: Page refresh hone par local storage se initial state safely uthao
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      // Safe check to avoid 'undefined' string crash
      if (savedUser && savedUser !== "undefined") {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.error("User storage parse error on mobile:", e);
    }
    return null;
  });

  const [token, setToken] = useState(() => {
    try {
      const savedToken = localStorage.getItem("token");
      return savedToken && savedToken !== "undefined" ? savedToken : null;
    } catch (e) {
      return null;
    }
  });

  // 📝 LOG IN & REGISTER PIPELINE (FIXED FOR MOBILE STORAGE GAP)
  const login = (authData) => {
    if (!authData || !authData.token) {
      console.error("Auth Data valid nahi hai bhai!");
      return;
    }

    const { token, user: userData } = authData;

    try {
      // 1. Pehle local storage mein completely commit (write) karein
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));

      // 2. Uske baad state update karein taaki synchronization gap na aaye
      setToken(token);
      setUser(userData);
      
      console.log("🎯 Mobile authentication saved and state synchronized successfully!");
    } catch (storageError) {
      console.error("Mobile Private Browsing storage restriction active:", storageError);
      
      // Fallback: Agar storage lock hai (Safari Private Mode), toh memory state se kaam chalayein
      setToken(token);
      setUser(userData);
    }
  };

  // 🚪 LOGOUT FUNCTION PIPELINE
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

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};