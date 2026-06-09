import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./components/dashboard";
import Home from "./pages/home"; // 🎯 FIX: 'Home' ka H capital kiya

// 🛠️ REFRESH REDIRECT ENGINE
// Yeh component check karega ki agar page refresh hua hai aur user '/home' par nahi hai, toh use wahan phek dega
const RefreshHandler = () => {
  useEffect(() => {
    if (window.location.pathname !== "/home") {
      window.location.replace("/home");
    }
  }, []); // Empty array ka matlab yeh sirf page reload par ek baar chalega

  return null;
};

function App() {
  return (
    <BrowserRouter>
      {/* ⚡ Yeh handler refresh hote hi trigger hoga */}
      <RefreshHandler /> 

      <Routes>
        {/* Main Routes */}
        <Route path="/home" element={<Home />} /> {/* 🎯 FIX: <Home /> component ab sahi hai */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Safe Fallback: Agar koi galat URL daale toh automatic /home par redirect ho jaye */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;