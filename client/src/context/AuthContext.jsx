import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 🎯 REFRESH FIX: Page refresh hone par local storage se initial state uthao
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token") || null;
  });

  // 📝 LOGIN FUNCTION PIPELINE
  const login = (authData) => {
    if (!authData || !authData.token) {
      console.error("Auth Data valid nahi hai bhai!");
      return;
    }

    // Backend payload se core entities extract karein
    const { token, user } = authData;

    // React State update layer
    setUser(user);
    setToken(token);

    // 🎯 CRITICAL FIX: Token aur User ko local storage me sahi keys ke sath save karein
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  };

  // 🚪 LOGOUT FUNCTION PIPELINE
  const logout = () => {
    setUser(null);
    setToken(null);
    
    // Clear storage references safely
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};