import { useState } from "react";
import { Link } from "react-router-dom";

// Simple Mock Icons for Features (Using SVG for ease of use)
const WalletIcon = () => (
  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const ReceiptIcon = () => (
  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export default function LandingPage() {
  // 👇 FIXED: Read from localStorage lazily during state setup instead of inside an effect
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      console.error("Error reading user session data:", e);
      return null;
    }
  });

  const features = [
    {
      title: "Budget Tracking",
      description: "Set your monthly financial limits and monitor your boundaries seamlessly.",
      icon: <WalletIcon />
    },
    {
      title: "Expense Management",
      description: "Log your daily expenditures with easy categorization and tags.",
      icon: <ReceiptIcon />
    },
    {
      title: "AI Insights",
      description: "Powered by OpenAI to give you smart, personalized saving suggestions.",
      icon: <SparklesIcon />
    },
    {
      title: "Spending Analysis",
      description: "Visualize where your money goes with simple, clean layout breakdowns.",
      icon: <ChartIcon />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 font-sans flex flex-col antialiased">
      
      {/* 1. NAVIGATION BAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline select-none">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">
              SBA
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">SmartBudget</span>
          </Link>
          
          <div className="flex items-center gap-6 font-medium text-sm">
            <a href="#home" className="text-slate-600 hover:text-blue-600 transition-colors no-underline">Home</a>
            <a href="#features" className="text-slate-600 hover:text-blue-600 transition-colors no-underline">Features</a>
            
            {user ? (
              <Link 
                to="/dashboard" 
                className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors no-underline"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-slate-600 hover:text-blue-600 transition-colors no-underline"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors no-underline"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <header id="home" className="bg-gradient-to-b from-blue-50 to-white py-20 px-4 border-b border-slate-200 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
            MERN Stack + OpenAI Project
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mt-6 mb-4 leading-tight">
            Take Control of Your Finances with AI
          </h1>
          <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed">
            Track expenses, manage budgets, and receive AI-powered financial insights. 
            Built simple and clean to help you manage your money efficiently.
          </p>
          <div className="flex flex-row gap-4 justify-center items-center">
            <Link 
              to="/register" 
              className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-md shadow-sm hover:bg-blue-700 transition-colors no-underline"
            >
              Get Started
            </Link>
            <a 
              href="#features" 
              className="bg-white border border-slate-300 text-slate-600 font-semibold px-6 py-3 rounded-md hover:bg-slate-50 transition-colors no-underline"
            >
              Learn More
            </a>
          </div>
        </div>
      </header>

      {/* 3. FEATURES SECTION */}
      <section id="features" className="py-20 px-4 max-w-6xl mx-auto w-full flex-grow">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Core Application Features</h2>
          <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
            Everything you need to monitor balances and saving metrics in one straightforward dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors"
            >
              <div className="w-11 h-11 bg-blue-50 rounded-md flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FOOTER SECTION */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-4 border-t border-slate-800 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-sm gap-4">
          <div>
            <p className="font-semibold text-white mb-0">Smart Budget Analyzer</p>
            <p className="text-xs text-slate-500 mt-1 mb-0">© {new Date().getFullYear()} College Capstone Project.</p>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Built with: React • Node.js • MongoDB • Express • OpenAI
          </div>
        </div>
      </footer>

    </div>
  );
}