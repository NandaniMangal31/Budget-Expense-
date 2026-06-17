import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext, AuthProvider } from "./context/AuthContext";

import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./components/dashboard";

/**
 * 🔒 Guard for Authenticated Pages
 * Block guests from accessing internal views
 */
const ProtectedRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  return token ? children : <Navigate to="/login" replace />;
};

/**
 * 🔓 Guard for Guest-Only Pages
 * Prevent already logged-in users from hitting login/register views again
 */
const PublicRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  return !token ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    // 🎯 CRITICAL FIX: Wrap your entire application structure inside the provider
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<Home />} />

          {/* Guest-Only Auth Pipeline Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* Secure Application Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
