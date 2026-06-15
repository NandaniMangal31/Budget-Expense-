import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // UI error label alerts ke liye handle lagaya

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/auth/register", {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
      });

      alert("Registration Successful!");
      console.log(response.data);
      navigate("/"); // Successful hone ke baad login page par redirect

    } catch (error) {
      console.error("Registration Error Trace:", error);
      
      const errorMessage = 
        error.response?.data?.message || 
        error.response?.data?.msg ||  
        "User already exists or Registration Failed";

      setError(errorMessage); // Form ke upar stylish banner dikhane ke liye update
      alert(errorMessage);
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans p-4 antialiased">
      
      {/* 🌐 TOP BRAND LOGO BLOCK */}
      <div className="flex items-center gap-2 mb-6 select-none animate-fade-in">
        <div className="bg-blue-600 text-white font-black text-xs px-2.5 py-1.5 rounded-lg shadow-sm tracking-wider">
          SBA
        </div>
        <span className="text-slate-900 font-bold text-lg tracking-tight">
          SmartBudget
        </span>
      </div>

      {/* 🎴 DUAL PANEL CONTAINER */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200 flex overflow-hidden min-h-[580px]">
        
        {/* 🧠 LEFT PANEL: AI BRANDING FEATURE LAYER */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 flex-col justify-between relative overflow-hidden select-none">
          
          {/* Decorative Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>

          {/* Central AI Dashboard Core Visual Art */}
          <div className="relative my-auto flex flex-col items-center">
            <div className="w-48 h-48 bg-gradient-to-tr from-blue-500/20 to-cyan-400/20 rounded-full flex items-center justify-center border border-blue-500/30 backdrop-blur-md relative shadow-2xl shadow-blue-500/10">
              
              {/* Inner glowing core node */}
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-white shadow-xl animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              </div>

              {/* Floating Orbiting Metric Nodes */}
              <span className="absolute top-3 text-emerald-400 font-bold text-sm bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">₹</span>
              <span className="absolute bottom-6 left-2 text-cyan-400 font-bold text-xs bg-slate-900/80 p-2 rounded-full border border-cyan-500/30">📊</span>
              <span className="absolute right-3 top-12 text-amber-400 font-bold text-xs bg-slate-900/80 p-2 rounded-full border border-amber-500/30">🤖</span>
            </div>
          </div>

          {/* Bottom Descriptive Brand Title */}
          <div className="relative z-10">
            <h2 className="text-white text-xl font-extrabold tracking-tight m-0 uppercase bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              AI Budget Analyser
            </h2>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
              Join the ecosystem to map, scan, and execute secure automated tracking strategies on your data matrices. Simple, clear, optimized.
            </p>
          </div>
        </div>

        {/* 🔐 RIGHT PANEL: ACCOUNT CREATION FORM FIELDS */}
        <div className="w-full md:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
          
          <div className="text-center mb-6">
            <h1 className="text-slate-900 font-black text-2xl tracking-tight m-0">
              Create Account
            </h1>
            <p className="text-slate-400 text-xs font-medium mt-1.5">
              Create an account to start tracking your finances.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-xl mb-4 leading-normal text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            
            {/* Full Name Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 tracking-wide" htmlFor="fullName">
                FULL NAME
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                required
                disabled={loading}
                placeholder="e.g., Jane Doe"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Email Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 tracking-wide" htmlFor="email">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                disabled={loading}
                placeholder="e.g., jane.doe@email.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 tracking-wide" htmlFor="password">
                CHOOSE PASSWORD
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                disabled={loading}
                minLength="8"
                placeholder="Enter a strong password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Confirm Password Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 tracking-wide" htmlFor="confirmPassword">
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                disabled={loading}
                minLength="8"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Registration Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl border-none cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] transition-all disabled:bg-blue-400 disabled:cursor-not-allowed disabled:shadow-none mt-3"
            >
              {loading ? "REGISTERING..." : "REGISTER 🚀"}
            </button>
          </form>

          {/* Form Bottom Utilities */}
          <div className="mt-6 text-center">
            <div className="relative flex py-2 items-center justify-center">
              <div className="absolute inset-x-0 border-t border-slate-200"></div>
              <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Already registered?
              </span>
            </div>

            <p className="text-xs font-medium text-slate-500 mt-4 mb-0">
              Already have an account?{" "}
              <span 
                onClick={() => navigate("/")} 
                className="text-blue-600 font-bold hover:text-blue-700 transition-all cursor-pointer hover:underline"
              >
                Login here.
              </span>
            </p>
          </div>

        </div>
      </div>

      {/* 3. FOOTER */}
      <footer className="w-full text-center text-xs text-slate-400 mt-8 select-none">
        <p className="m-0">&copy; {new Date().getFullYear()} Smart Budget Analyzer. Built for Academic Evaluation.</p>
      </footer>

    </div>
  );
}

export default Register;