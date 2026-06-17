import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      };

      const response = await API.post("/auth/login", payload);

      // Let context securely dictate storage & state logic globally
      login(response.data); 
      
      navigate("/dashboard");
    } catch (err) {
      console.error("Frontend Login Error Trace:", err);
      setError(
        err.response?.data?.msg || 
        err.response?.data?.message || 
        "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans p-4 antialiased">
      <Link to="/" className="flex items-center gap-2 mb-6 select-none no-underline">
        <div className="bg-blue-600 text-white font-black text-xs px-2.5 py-1.5 rounded-lg shadow-sm tracking-wider">
          SBA
        </div>
        <span className="text-slate-900 font-bold text-lg tracking-tight">SmartBudget</span>
      </Link>

      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200 flex overflow-hidden min-h-[540px]">
        {/* LEFT PANEL: FEATURE LAYER */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 flex-col justify-between relative overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
          <div className="relative my-auto flex flex-col items-center">
            <div className="w-48 h-48 bg-gradient-to-tr from-blue-500/20 to-cyan-400/20 rounded-full flex items-center justify-center border border-blue-500/30 backdrop-blur-md relative shadow-2xl shadow-blue-500/10">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-white shadow-xl animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21L14.907 14M14.09 8.11L15 3L9.093 10M19 10.5h-4.5M9.5 13.5H5" />
                </svg>
              </div>
              <span className="absolute top-3 text-emerald-400 font-bold text-sm bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">₹</span>
              <span className="absolute bottom-6 left-2 text-cyan-400 font-bold text-xs bg-slate-900/80 p-2 rounded-full border border-cyan-500/30">📊</span>
              <span className="absolute right-3 top-12 text-amber-400 font-bold text-xs bg-slate-900/80 p-2 rounded-full border border-amber-500/30">🤖</span>
            </div>
          </div>
          <div className="relative z-10">
            <h2 className="text-white text-xl font-extrabold tracking-tight m-0 uppercase bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              AI Budget Analyser
            </h2>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
              Harness the power of machine learning for personalized, automated financial insights and control.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL: FORM FIELDS */}
        <div className="w-full md:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h1 className="text-slate-900 font-black text-2xl tracking-tight m-0">Welcome Back</h1>
            <p className="text-slate-400 text-xs font-medium mt-1.5">Log in to manage your budget and check AI insights</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-xl mb-4 text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide" htmlFor="email">EMAIL ADDRESS</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                disabled={loading}
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 tracking-wide" htmlFor="password">PASSWORD</label>
                <a href="#forgot" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-all no-underline">Forgot password?</a>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                required
                disabled={loading}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl border-none cursor-pointer shadow-md transition-all disabled:bg-blue-400 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <div className="relative flex py-2 items-center justify-center">
              <div className="absolute inset-x-0 border-t border-slate-200"></div>
              <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">New to the platform?</span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-4 mb-0">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-600 font-bold hover:text-blue-700 transition-all no-underline hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="w-full text-center text-xs text-slate-400 mt-8 select-none">
        <p className="m-0">&copy; {new Date().getFullYear()} Smart Budget Analyzer. Built for Academic Evaluation.</p>
      </footer>
    </div>
  );
}