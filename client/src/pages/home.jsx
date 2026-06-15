import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Aapne jo custom Login aur Register components banaye hain, unhe yahan sahi path se import karein
import Login from "./login";
import Register from "./register";

export default function Home() {
  // Toggle state: "login" ya "register" split panels ke liye
  const [activeForm, setActiveForm] = useState("login");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans antialiased box-border">
      
      {/* 🌐 PREMIUM GLASS NAVBAR */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2.5 select-none">
          <div className="bg-blue-600 text-white font-black text-xs px-2.5 py-1.5 rounded-lg shadow-md tracking-wider">
            SBA
          </div>
          <span className="font-extrabold text-lg text-slate-900 tracking-tight">
            SmartBudget <span className="text-blue-600 font-medium text-xs">AI Core</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveForm("login")} 
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all border-none cursor-pointer ${activeForm === "login" ? "bg-slate-900 text-white" : "bg-transparent text-slate-600 hover:bg-slate-100"}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => setActiveForm("register")} 
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all border-none cursor-pointer ${activeForm === "register" ? "bg-slate-900 text-white" : "bg-transparent text-slate-600 hover:bg-slate-100"}`}
          >
            Join Free
          </button>
        </div>
      </nav>

      {/* 🎴 HERO MULTI-PANEL SPLIT ENGINE */}
      <main className="max-w-7xl w-full mx-auto p-6 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-grow box-border">
        
        {/* LEFT COLUMN: HERO MARKETING VALUE PROPOSITION */}
        <div className="lg:col-span-7 space-y-6 text-left select-none">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200/50 text-xs font-bold tracking-wide uppercase">
            ✨ Next-Gen Capstone Analytics Platform
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none m-0">
            Automate Your Cashflows with <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI Matrix Core</span>
          </h1>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium max-w-xl m-0">
            Upload loose receipts, scan ledger PDFs, and monitor live spending thresholds against targeted budget configurations instantly. Safe, localized, and mathematically structured.
          </p>

          {/* Feature Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="flex items-center gap-3 bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
              <span className="text-xl">📸</span>
              <div>
                <h4 className="text-xs font-black text-slate-900 m-0">Universal OCR Scanning</h4>
                <p className="text-[11px] font-medium text-slate-400 m-0 mt-0.5">Parse PNG/PDF records instantly.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
              <span className="text-xl">🎯</span>
              <div>
                <h4 className="text-xs font-black text-slate-900 m-0">Strict Allocation Targets</h4>
                <p className="text-[11px] font-medium text-slate-400 m-0 mt-0.5">Get automatic breach warnings.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DYNAMIC CONTROL BOX (FORM HOST) */}
        <div className="lg:col-span-5 w-full flex flex-col items-center">
          <div className="w-full bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden p-8 box-border relative">
            
            {/* Top Interactive Form Header Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6 select-none">
              <button 
                onClick={() => setActiveForm("login")} 
                className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${activeForm === "login" ? "bg-white text-slate-900 shadow-xs" : "bg-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Access Account
              </button>
              <button 
                onClick={() => setActiveForm("register")} 
                className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${activeForm === "register" ? "bg-white text-slate-900 shadow-xs" : "bg-transparent text-slate-400 hover:text-slate-600"}`}
              >
                New Registration
              </button>
            </div>

            {/* Form Rendering Routing */}
            <div className="transition-all duration-300">
              {activeForm === "login" ? (
                <div>
                  {/* NOTE: Agar aapke pas direct components hain, toh <Login /> call karein */}
                  <h3 className="text-slate-900 font-bold text-lg tracking-tight m-0 text-center">Welcome Back</h3>
                  <p className="text-slate-400 text-xs text-center mt-1 mb-4">Log in to manage your budget and check AI insights</p>
                  
                  {/* Static Placeholder for Form Concept - Direct Mapping Recommended */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wide">EMAIL ADDRESS</label>
                      <input type="email" placeholder="yashiagrawa14@gmail.com" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wide">PASSWORD</label>
                      <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50" />
                    </div>
                    <button className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-xl border-none cursor-pointer shadow-sm mt-2">Log In</button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* NOTE: Aap chahein toh yahan seedhe apna <Register /> component include kar sakte hain */}
                  <h3 className="text-slate-900 font-bold text-lg tracking-tight m-0 text-center">Create Account</h3>
                  <p className="text-slate-400 text-xs text-center mt-1 mb-4">Start monitoring matrices in under two minutes</p>
                  
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wide">FULL NAME</label>
                      <input type="text" placeholder="e.g., Jane Doe" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wide">EMAIL ADDRESS</label>
                      <input type="email" placeholder="jane.doe@email.com" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wide">CHOOSE PASSWORD</label>
                      <input type="password" placeholder="Min 8 characters" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50" />
                    </div>
                    <button className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-xl border-none cursor-pointer shadow-sm mt-2">Register 🚀</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </main>

      {/* 🌐 CLEAN ACADEMIC FOOTER */}
      <footer className="w-full text-center py-5 text-xs text-slate-400 border-t border-slate-200 bg-white select-none">
        &copy; {new Date().getFullYear()} Smart Budget Analyzer. Built for Academic Evaluation.
      </footer>

    </div>
  );
}