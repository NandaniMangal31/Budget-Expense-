import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import ExpenseForm from "./expenseform.jsx";

// Import Custom Modularized Architecture Components
import BudgetModal from "./BudgetModal";
import MetricCards from "./MetricCards";
import CategoryAnalysis from "./CategoryAnalysis";
import ExpenseLogsTable from "./ExpenseLogsTable";
// 👇 IMPORT NEW COMPONENT HERE
import ProfileModal from "./ProfileModal"; 

export default function Dashboard() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  
  // 🎯 BUDGET ENGINE STATES
  const [budgetConfig, setBudgetConfig] = useState({ totalBudget: "0", categoryTargets: {} });
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  // 👇 ADD NEW CONTROL MODAL STATE
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  
  const [targetInputs, setTargetInputs] = useState({
    totalBudget: "",
    "Food & Drinks": "",
    "Travel & Transport": "",
    "Shopping": "",
    "Bills & Utilities": "",
    "Entertainment": "",
    "Other": ""
  });

  const [userId] = useState(() => {
    const storedUser = localStorage.getItem("user");
    try { return storedUser ? JSON.parse(storedUser)?._id || "" : ""; } catch { return ""; }
  });

  const [userMetadata] = useState(() => {
    const storedUser = localStorage.getItem("user");
    try { return { name: storedUser ? JSON.parse(storedUser)?.name || "User" : "User" }; } catch { return { name: "User" }; }
  });

  const [deletingId, setDeletingId] = useState(null);

  // ==========================================
  // ⚡ UTILITY PARSING SYSTEMS
  // ==========================================
  const parseSafeAmount = (amountVal) => {
    if (!amountVal) return 0;
    let str = amountVal.toString().toLowerCase().replace(/,/g, "").trim();
    if (str.includes("-")) str = str.split("-")[0].trim();

    let multiplier = 1;
    if (str.includes("lakh") || str.includes("lk")) multiplier = 100000;
    else if (str.includes("crore") || str.includes("cr")) multiplier = 10000000;
    else if (str.includes("m")) multiplier = 1000000;
    else if (str.includes("k")) multiplier = 1000;

    str = str.replace(/lakh|lk|crore|cr|m|k/g, "");
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val * multiplier;
  };

  const formatAdvancedAmount = (amountVal, isDollar = false) => {
    if (amountVal === undefined || amountVal === null || amountVal === "") return isDollar ? "$0" : "₹0";
    const str = amountVal.toString().trim();
    if (str.includes("-")) {
      const parts = str.split("-");
      return `${formatSingleAdvanced(parts[0], isDollar)}-${formatSingleAdvanced(parts[1], isDollar)}`;
    }
    return formatSingleAdvanced(str, isDollar);
  };

  const formatSingleAdvanced = (numStr, isDollar) => {
    const num = parseSafeAmount(numStr);
    if (num === 0 && isNaN(Number(numStr))) return numStr;
    if (isDollar) {
      if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
      if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
      if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
      return `$${Math.round(num)}`;
    } else {
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
      if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakh`;
      return `₹${num.toLocaleString("en-IN")}`;
    }
  };

  // ==========================================
  // 🚀 PIPELINE LAYER DATA SYNCING
  // ==========================================
  const fetchDashboardData = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (!storedUser || !token) return;

      const currentUserId = JSON.parse(storedUser)?._id;
      if (!currentUserId) return;

      try {
        const resExpenses = await API.get(`/expenses/${currentUserId}`);
        if (resExpenses.data) setExpenses(resExpenses.data);
      } catch (err) { console.error(err.message); }

      try {
        const resBudget = await API.get(`/budgets/${currentUserId}`);
        if (resBudget && resBudget.data) {
          setBudgetConfig(resBudget.data);
          setTargetInputs({
            totalBudget: resBudget.data.totalBudget || "",
            "Food & Drinks": resBudget.data.categoryTargets?.["Food & Drinks"] || "",
            "Travel & Transport": resBudget.data.categoryTargets?.["Travel & Transport"] || "",
            "Shopping": resBudget.data.categoryTargets?.["Shopping"] || "",
            "Bills & Utilities": resBudget.data.categoryTargets?.["Bills & Utilities"] || "",
            "Entertainment": resBudget.data.categoryTargets?.["Entertainment"] || "",
            "Other": resBudget.data.categoryTargets?.["Other"] || ""
          });
        }
      } catch (err) { console.log("No targets found."); }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const refreshExpenses = async () => {
    if (!userId) return;
    try {
      const res = await API.get(`/expenses/${userId}`);
      if (res.data) setExpenses(res.data);
    } catch (err) { console.log(err); }
  };

  const handleSaveBudgetConfig = async () => {
    if (!userId) return;
    try {
      const payload = {
        userId,
        totalBudget: targetInputs.totalBudget || "0",
        categoryTargets: {
          "Food & Drinks": targetInputs["Food & Drinks"] || "0",
          "Travel & Transport": targetInputs["Travel & Transport"] || "0",
          "Shopping": targetInputs["Shopping"] || "0",
          "Bills & Utilities": targetInputs["Bills & Utilities"] || "0",
          "Entertainment": targetInputs["Entertainment"] || "0",
          "Other": targetInputs["Other"] || "0"
        }
      };
      const res = await API.post("/budgets/set", payload);
      alert(res.data?.msg || "Custom budget metrics locked! 🏆");
      setBudgetConfig(payload); 
      setIsBudgetFormOpen(false);
    } catch (err) { alert("Failed to synchronize targets."); }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      setDeletingId(expenseId);
      await API.delete(`/expenses/${expenseId}`);
      setExpenses((prev) => prev.filter((item) => item._id !== expenseId));
      alert("Expense log successfully deleted!");
    } catch (err) { console.error(err); } 
    finally { setDeletingId(null); }
  };

  // ==========================================
  // 📊 CALCULATED IN-MEMORY STRUCTS
  // ==========================================
  const parsedMonthlyBudget = parseSafeAmount(budgetConfig.totalBudget);
  const totalExpenses = expenses.reduce((sum, item) => sum + parseSafeAmount(item.amount), 0);
  const remainingBudget = parsedMonthlyBudget - totalExpenses;

  const categoryTotals = expenses.reduce((acc, curr) => {
    let cat = curr.category || "Other";
    if (cat.toLowerCase().trim() === "food") cat = "Food & Drinks";
    acc[cat] = (acc[cat] || 0) + parseSafeAmount(curr.amount);
    return acc;
  }, {});

  const getCategoryStyles = (categoryName) => {
    const normalized = (categoryName || "").toLowerCase().trim();
    if (normalized.includes("food")) return { dot: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50 border-blue-100" };
    if (normalized.includes("travel") || normalized.includes("transport")) return { dot: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" };
    if (normalized.includes("shopping")) return { dot: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-50 border-purple-100" };
    if (normalized.includes("bill") || normalized.includes("utility")) return { dot: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50 border-amber-100" };
    if (normalized.includes("entertainment")) return { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50 border-red-100" };
    if (normalized.includes("other")) return { dot: "bg-pink-500", text: "text-pink-600", bg: "bg-pink-50 border-pink-100" };
    return { dot: "bg-green-500", text: "text-green-600", bg: "bg-green-50 border-green-100" };
  };

  const displayExpenses = expenses.length > 0 ? [...expenses].reverse() : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans flex flex-col antialiased">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => navigate("/")}>
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">SBA</div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">SmartBudget</span>
          </div>
          <div className="flex items-center gap-5">
            {/* 👇 UPDATED BUTTON EVENT HERE */}
            <button 
              onClick={() => setIsProfileOpen(true)} 
              className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 transition-colors"
            >
              👤 Personal Account
            </button>
            <button onClick={() => { localStorage.clear(); navigate("/"); }} className="text-sm font-semibold text-red-600 hover:text-red-800 bg-none border-none cursor-pointer transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      {/* MAIN LAYOUT CONTAINER */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-6 flex-grow box-border">
        
        {/* BANNER */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 m-0">Welcome Back, {userMetadata.name}!</h1>
            <p className="text-sm text-slate-400 mt-1 m-0">Manage your self-assigned budget allocations and live data trends.</p>
          </div>
          <button onClick={() => setIsBudgetFormOpen(!isBudgetFormOpen)} className="text-xs font-bold bg-slate-900 text-white px-4 py-2.5 rounded-lg border-none hover:bg-slate-800 transition-all shadow-xs cursor-pointer flex items-center gap-1.5">
            🎯 {isBudgetFormOpen ? "Close Control Panel" : "Setup Manual Budgets"}
          </button>
        </div>

        {/* PROFILE MODAL INJECTION */}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} userMetadata={userMetadata} />

        {/* MODAL MODULAR PANEL */}
        <BudgetModal isOpen={isBudgetFormOpen} targetInputs={targetInputs} setTargetInputs={setTargetInputs} onSave={handleSaveBudgetConfig} onClose={() => setIsBudgetFormOpen(false)} />

        {/* TRANSACTION INPUT ENGINES */}
        <ExpenseForm refresh={refreshExpenses} />

        {/* TOP CARDS ROW */}
        <MetricCards totalBudget={budgetConfig.totalBudget || "0"} totalExpenses={totalExpenses} remainingBudget={remainingBudget} parsedMonthlyBudget={parsedMonthlyBudget} formatAdvancedAmount={formatAdvancedAmount} />

        {/* SPLIT ANALYTICS MATRIX GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <CategoryAnalysis expenses={expenses} categoryTotals={categoryTotals} totalExpenses={totalExpenses} budgetConfig={budgetConfig} parseSafeAmount={parseSafeAmount} getCategoryStyles={getCategoryStyles} formatAdvancedAmount={formatAdvancedAmount} />
          
          <ExpenseLogsTable displayExpenses={displayExpenses} getCategoryStyles={getCategoryStyles} formatAdvancedAmount={formatAdvancedAmount} onDeleteExpense={handleDeleteExpense} deletingId={deletingId} />
        </div>
      </main>

      <footer className="text-center p-5 text-xs text-slate-400 border-t border-slate-200 bg-white mt-auto">
        &copy; {new Date().getFullYear()} Smart Budget Analyzer. Academic Capstone Project.
      </footer>
    </div>
  );
}