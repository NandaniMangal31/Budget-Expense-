import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      // 🎯 FIX 1: Trim spacing and normalize input formatting values
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      };

      // 1. Send authentication request to Express backend
      const response = await API.post("/auth/login", payload);

      // 2. Save user/token into context (Updates state globally)
      if (login) {
        login(response.data); 
      } else {
        // Fallback injection structure
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      
      alert("Login Successful!");
      
      // 3. Navigate user straight to the application dashboard
      navigate("/dashboard");

    } catch (error) {
      console.error("Frontend Login Error Trace:", error);
      
      // 🎯 FIX 2: Backend custom mapping check (.data.msg verification pipeline)
      setError(
        error.response?.data?.msg || 
        error.response?.data?.message || 
        "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 font-sans flex flex-col antialiased">
      
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline select-none">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">
              SBA
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">SmartBudget</span>
          </Link>
          <Link 
            to="/" 
            className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors no-underline"
          >
          </Link>
        </div>
      </header>

      {/* 2. CENTERED LOGIN CARD */}
      <main className="flex items-center justify-center px-4 py-12">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-md w-full">
          
          {/* Card Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome Back</h2>
            <p className="text-sm text-slate-500">
              Log in to manage your budget and check AI insights
            </p>
          </div>

          {/* Dynamic Error Banner Display */}
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-md text-center font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="email">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-900"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-600" htmlFor="password">
                  Password
                </label>
                <a href="#forgot" className="text-xs text-blue-600 no-underline hover:underline">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-900"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm hover:bg-blue-700 transition-colors mt-2 disabled:bg-blue-400 disabled:cursor-not-allowed text-sm cursor-pointer"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          {/* Custom Horizontal Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
              <span className="bg-white px-3 text-slate-400">New to the platform?</span>
            </div>
          </div>

          {/* Route Transition Link to Register */}
          <div className="text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="font-semibold text-blue-600 no-underline hover:underline"
            >
              Create an account
            </Link>
          </div>

        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-auto">
        <p className="m-0">&copy; {new Date().getFullYear()} Smart Budget Analyzer. Built for Academic Evaluation.</p>
      </footer>

    </div>
  );
}