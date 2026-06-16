import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({ email: "", password: "" });
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
        password: formData.password,
      };

      const response = await API.post("/auth/login", payload);

      if (login) {
        login(response.data);
      } else {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      alert("Login Successful!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Login Error:", err);
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-blue-600 text-white font-black text-xs px-2.5 py-1.5 rounded-lg">
          SBA
        </div>
        <span className="text-slate-900 font-bold text-lg">SmartBudget</span>
      </div>

      {/* Container */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border flex overflow-hidden min-h-[540px]">
        {/* Left Branding Panel */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 flex-col justify-between relative">
          {/* Decorative visuals omitted for brevity */}
          <h2 className="text-white text-xl font-extrabold">AI Budget Analyser</h2>
          <p className="text-slate-400 text-xs mt-2">
            Harness machine learning for personalized financial insights.
          </p>
        </div>

        {/* Right Form Panel */}
        <div className="w-full md:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h1 className="text-slate-900 font-black text-2xl">Welcome Back</h1>
            <p className="text-slate-400 text-xs">Log in to manage your budget</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-xl mb-4 text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1.5">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                disabled={loading}
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 mb-1.5">
                PASSWORD
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                disabled={loading}
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border rounded-xl text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 text-white font-bold text-sm rounded-xl"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-600 font-bold">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="w-full text-center text-xs text-slate-400 mt-8">
        &copy; {new Date().getFullYear()} Smart Budget Analyzer. Built for Academic Evaluation.
      </footer>
    </div>
  );
}
