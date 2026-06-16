import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/register", {
        name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      alert("Registration Successful!");
      navigate("/login");
    } catch (err) {
      console.error("Registration Error:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.msg ||
        "User already exists or Registration Failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans p-4 antialiased">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6 select-none">
        <div className="bg-blue-600 text-white font-black text-xs px-2.5 py-1.5 rounded-lg shadow-sm">
          SBA
        </div>
        <span className="text-slate-900 font-bold text-lg">SmartBudget</span>
      </div>

      {/* Container */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border flex overflow-hidden min-h-[580px]">
        {/* Left Branding Panel */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 flex-col justify-between relative">
          <h2 className="text-white text-xl font-extrabold">AI Budget Analyser</h2>
          <p className="text-slate-400 text-xs mt-2">
            Join the ecosystem to map, scan, and execute secure automated tracking strategies.
          </p>
        </div>

        {/* Right Form Panel */}
        <div className="w-full md:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
          <div className="text-center mb-6">
            <h1 className="text-slate-900 font-black text-2xl">Create Account</h1>
            <p className="text-slate-400 text-xs">Start tracking your finances today.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-xl mb-4 text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 mb-1">
                FULL NAME
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                disabled={loading}
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={loading}
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 mb-1">
                PASSWORD
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={loading}
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 mb-1">
                CONFIRM PASSWORD
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                disabled={loading}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-xl text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 text-white font-bold text-sm rounded-xl"
            >
              {loading ? "Registering..." : "Register 🚀"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <span
                onClick={() => navigate("/login")}
                className="text-blue-600 font-bold cursor-pointer hover:underline"
              >
                Login here
              </span>
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
