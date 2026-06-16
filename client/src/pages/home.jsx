import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans antialiased">
      
      {/* 🌐 Navigation Header */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 sm:px-12 py-4 flex justify-between items-center shadow-sm">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => navigate("/")}
        >
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-black text-sm">
            SBA
          </div>
          <span className="font-black text-lg text-slate-900 tracking-tight">
            SmartBudget{" "}
            <span className="text-blue-600 font-medium text-xs">AI Core</span>
          </span>
        </div>

        {/* Right Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-2.5 rounded-xl transition-all"
          >
            Sign In / Login
          </button>
          <button
            onClick={() => navigate("/register")}
            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl shadow-sm transition-all hidden sm:inline-block"
          >
            Create Account
          </button>
        </div>
      </nav>

      {/* 🎴 Hero Section */}
      <main className="max-w-7xl w-full mx-auto p-6 sm:p-12 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-grow">
        
        {/* Left Content */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border text-xs font-bold uppercase">
            ✨ Next-Gen Capstone Analytics Platform
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-tight">
            Automate Your Cashflows with{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              AI Matrix Core
            </span>
          </h1>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium max-w-xl">
            Upload receipts, scan ledger PDFs, and monitor live spending thresholds against targeted budget configurations instantly. Safe, localized, and mathematically structured.
          </p>
          <div className="pt-4">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 px-6 py-3.5 rounded-xl shadow-md transition-all"
            >
              Get Started Instantly →
            </button>
          </div>
        </div>

        {/* Right Visual Block */}
        <div className="lg:col-span-5 w-full select-none">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-slate-900">Live Matrix Analytics</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Efficiency</span>
                <span className="text-base font-black text-slate-900">98.4% Accuracy Locked</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Active Sync Model</span>
                <span className="text-xs font-bold text-blue-600">Universal PDF/OCR Parser Online</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 🌐 Footer */}
      <footer className="w-full text-center py-5 text-xs text-slate-400 border-t border-slate-200 bg-white">
        &copy; {new Date().getFullYear()} Smart Budget Analyzer. Built for Academic Evaluation.
      </footer>
    </div>
  );
}
