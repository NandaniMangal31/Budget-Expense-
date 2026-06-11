import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import ExpenseForm from "./expenseform.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  
  // 🎯 DYNAMIC BUDGET ENGINE STATES
  const [budgetConfig, setBudgetConfig] = useState({ totalBudget: "0", categoryTargets: {} });
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  
  // 🚨 Category keys matched exactly with database schema naming standards
  const [targetInputs, setTargetInputs] = useState({
    totalBudget: "",
    "Food & Drinks": "",
    "Travel & Transport": "",
    "Shopping": "",
    "Bills & Utilities": "",
    "Entertainment": "",
    "Other": ""
  });

  // ==========================================
  // 🛠️ LAZY STATE INITIALIZATION FROM LOCALSTORAGE
  // ==========================================
  const [userId, setUserId] = useState(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        return JSON.parse(storedUser)?._id || "";
      } catch { return ""; }
    }
    return "";
  });

  const [userMetadata, setUserMetadata] = useState(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        return { name: JSON.parse(storedUser)?.name || "User" };
      } catch { return { name: "User" }; }
    }
    return { name: "User" };
  });

  const [deletingId, setDeletingId] = useState(null);

  // ==========================================
  // ⚡ UTILITY: SMART INDIAN & INT. CURRENCY PARSING & FORMATTING
  // ==========================================
  const parseSafeAmount = (amountVal) => {
    if (!amountVal) return 0;
    let str = amountVal.toString().toLowerCase().replace(/,/g, "").trim();
    
    if (str.includes("-")) {
      str = str.split("-")[0].trim();
    }

    let multiplier = 1;
    if (str.includes("lakh") || str.includes("lk")) {
      multiplier = 100000;
      str = str.replace(/lakh|lk/g, "");
    } else if (str.includes("crore") || str.includes("cr")) {
      multiplier = 10000000;
      str = str.replace(/crore|cr/g, "");
    } else if (str.includes("m")) {
      multiplier = 1000000;
      str = str.replace(/m/g, "");
    } else if (str.includes("k")) {
      multiplier = 1000;
      str = str.replace(/k/g, "");
    }

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
  // 🚀 FIXED DATA FETCHING PIPELINE
  // ==========================================
  const fetchDashboardData = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!storedUser || !token) {
        console.log("Auth session variables missing from storage.");
        return;
      }

      const userData = JSON.parse(storedUser);
      const currentUserId = userData?._id;
      if (!currentUserId) return;

      // 🔄 Pipeline 1: Fetch user transaction logs
      try {
        const resExpenses = await API.get(`/expenses/${currentUserId}`);
        if (resExpenses.data) setExpenses(resExpenses.data);
      } catch (expErr) {
        console.error("Expenses parsing logs issue:", expErr.message);
      }

      // 🎯 Pipeline 2: Fetch personalized targets allocation configurations
      try {
        // GET request is passed with /:userId matching the backend schema design perfectly
        const resBudget = await API.get(`/budgets/${userId}`);
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
      } catch (err) {
        console.error("No custom limits mapped for this user profile yet. Dashboard working on zero-state matrix.",err.message);
      }

    } catch (err) {
      console.error("Dashboard Global Fetch Layer Exception Error:", err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refreshExpenses = async () => {
    if (!userId) return;
    try {
      const res = await API.get(`/expenses/${userId}`);
      if (res.data) setExpenses(res.data);
    } catch (err) {
      console.log("Error refreshing logs:", err);
    }
  };

  // ==========================================
  // 💾 BUDGET FORM SUBMISSION ENGINE
  // ==========================================
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

      // 🎯 Explicit target routed to /budgets/set safely
      const res = await API.post("/budgets/set", payload);
      alert(res.data?.msg || "Custom budget metrics locked! 🏆");
      setBudgetConfig(payload); 
      setIsBudgetFormOpen(false);
    } catch (err) {
      console.error("Budget save process anomaly:", err);
      alert("Failed to synchronize targeted allocations. Check if your backend server cluster is online.");
    }
  };

  // ==========================================
  // 📊 LIVE ANALYTICS CALCULATIONS
  // ==========================================
  const parsedMonthlyBudget = parseSafeAmount(budgetConfig.totalBudget);
  const totalExpenses = expenses.reduce((sum, item) => sum + parseSafeAmount(item.amount), 0);
  const remainingBudget = parsedMonthlyBudget - totalExpenses;

  const categoryTotals = expenses.reduce((acc, curr) => {
    const cat = curr.category || "Other";
    acc[cat] = (acc[cat] || 0) + parseSafeAmount(curr.amount);
    return acc;
  }, {});

  const categoryColors = {
    "Food & Drinks": { dot: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    "Travel & Transport": { dot: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    "Shopping": { dot: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
    "Bills & Utilities": { dot: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    "Entertainment": { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50 border-red-100" },
    "Other": { dot: "bg-slate-500", text: "text-slate-600", bg: "bg-slate-50 border-slate-100" }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      setDeletingId(expenseId);
      await API.delete(`/expenses/${expenseId}`);
      setExpenses((prevExpenses) => prevExpenses.filter((item) => item._id !== expenseId));
      alert("Expense log successfully deleted!");
    } catch (err) {
      console.error("Deletion Pipeline Failure:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const recentExpenses = expenses.length > 0 ? [...expenses].slice(-5).reverse() : [];

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans flex flex-col antialiased">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => navigate("/")}>
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">
              SBA
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">SmartBudget</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
              👤 Personal Account
            </span>
            <button 
              onClick={handleLogout} 
              className="text-sm font-semibold text-red-600 hover:text-red-800 bg-none border-none cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-6 flex-grow box-border">
        
        {/* WELCOME BANNER */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 m-0">
              Welcome Back, {userMetadata.name}!
            </h1>
            <p className="text-sm text-slate-400 mt-1 m-0">
              Manage your self-assigned budget allocations and live data trends.
            </p>
          </div>
          <button 
            onClick={() => setIsBudgetFormOpen(!isBudgetFormOpen)}
            className="text-xs font-bold bg-slate-900 text-white px-4 py-2.5 rounded-lg border-none hover:bg-slate-800 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            🎯 {isBudgetFormOpen ? "Close Control Panel" : "Setup Manual Budgets"}
          </button>
        </div>

        {/* BUDGET ALLOCATION PANEL */}
        {isBudgetFormOpen && (
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            <div className="sm:col-span-3 border-b border-slate-100 pb-2 mb-1">
              <h3 className="text-sm font-bold text-slate-900 m-0">Manual Threshold Calibration Gateway</h3>
              <p className="text-[11px] text-slate-400 m-0">Configure personalized limits</p>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Total Base Target (Overall)</label>
              <input type="text" value={targetInputs.totalBudget} placeholder="e.g. 50000" onChange={(e)=>setTargetInputs({...targetInputs, totalBudget: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">🍔 Food Pool Cap</label>
              <input type="text" value={targetInputs["Food & Drinks"]} placeholder="e.g. 8000" onChange={(e)=>setTargetInputs({...targetInputs, "Food & Drinks": e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">🚌 Travel & Logistics Cap</label>
              <input type="text" value={targetInputs["Travel & Transport"]} placeholder="e.g. 4000" onChange={(e)=>setTargetInputs({...targetInputs, "Travel & Transport": e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">🛍️ Shopping Target</label>
              <input type="text" value={targetInputs.Shopping} placeholder="e.g. 15000" onChange={(e)=>setTargetInputs({...targetInputs, Shopping: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">🧾 Utility Bills Target</label>
              <input type="text" value={targetInputs["Bills & Utilities"]} placeholder="e.g. 6000" onChange={(e)=>setTargetInputs({...targetInputs, "Bills & Utilities": e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">🎬 Entertainment Limit</label>
              <input type="text" value={targetInputs.Entertainment} placeholder="e.g. 3000" onChange={(e)=>setTargetInputs({...targetInputs, Entertainment: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none" />
            </div>
            
            <div className="sm:col-span-3 flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setIsBudgetFormOpen(false)} className="px-4 py-2 text-xs bg-slate-100 border rounded-md font-semibold cursor-pointer text-slate-600 hover:bg-slate-200">Cancel</button>
              <button type="button" onClick={handleSaveBudgetConfig} className="px-5 py-2 text-xs bg-emerald-600 text-white border-none rounded-md font-bold cursor-pointer hover:bg-emerald-700">Lock Targets 💾</button>
            </div>
          </div>
        )}

        {/* INPUT ENGINES */}
        <ExpenseForm refresh={refreshExpenses} />

        {/* METRIC CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Monthly Allocation</p>
            <p className="text-xl md:text-2xl font-extrabold text-slate-900 my-1 truncate">
              {formatAdvancedAmount(budgetConfig.totalBudget || "0")}
            </p>
            <p className="text-xs text-slate-400 font-medium m-0 truncate">
              Approx: {formatAdvancedAmount(parsedMonthlyBudget / 83, true)} USD
            </p>
            <div className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 w-fit mt-2">🎯 Self-Configured</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Total Expenses</p>
            <p className="text-xl md:text-2xl font-extrabold text-slate-900 my-1 truncate">
              {formatAdvancedAmount(totalExpenses)}
            </p>
            <p className="text-xs text-slate-400 font-medium m-0 truncate">
              Approx: {formatAdvancedAmount(totalExpenses / 83, true)} USD
            </p>
            <div className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 w-fit mt-2">💸 Outgoing Logs</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Remaining Balance</p>
            <p className={`text-xl md:text-2xl font-extrabold my-1 truncate ${remainingBudget < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {remainingBudget < 0 ? "-" : ""}{formatAdvancedAmount(Math.abs(remainingBudget))}
            </p>
            <p className="text-xs text-slate-400 font-medium m-0 truncate">
              Approx: {formatAdvancedAmount(Math.abs(remainingBudget) / 83, true)} USD
            </p>
            <div className={`text-xs font-semibold px-2 py-0.5 rounded w-fit mt-2 ${
              remainingBudget < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {remainingBudget < 0 ? "⚠️ Overbudget" : "🚀 Safe Limit"}
            </div>
          </div>
        </div>

        {/* DATA SPLIT SECTION MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs lg:col-span-1">
            <h3 className="text-base font-bold text-slate-900 m-0">Category Analysis</h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">Distribution and budget health indicators</p>

            {expenses.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400 font-medium italic">No expense records found.</div>
            ) : (
              <div className="flex flex-col gap-4 mt-4">
                {Object.entries(categoryTotals).map(([category, amount]) => {
                  const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : 0;
                  const colors = categoryColors[category] || categoryColors.Other;
                  
                  const specificTargetStr = budgetConfig.categoryTargets?.[category] || "0";
                  const specificTargetNum = parseSafeAmount(specificTargetStr);
                  const isBreached = specificTargetNum > 0 && amount > specificTargetNum;

                  return (
                    <div key={category} className="p-1 rounded-md">
                      <div className="flex justify-between items-center text-xs text-slate-600 mb-1 gap-2">
                        <span className="flex items-center gap-1.5 font-medium truncate">
                          <span className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${colors.dot}`}></span>
                          <span className="truncate">{category}</span>
                        </span>
                        <span className={`font-bold shrink-0 ${isBreached ? "text-red-600" : "text-slate-900"}`}>
                          {formatAdvancedAmount(amount)} / {specificTargetNum > 0 ? formatAdvancedAmount(specificTargetStr) : "No Cap"}
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${isBreached ? "bg-red-500" : colors.dot}`} 
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      
                      {isBreached && (
                        <p className="text-[10px] text-red-500 font-semibold m-0 mt-0.5 animate-pulse">⚠️ Allocation breached!</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table Container Display */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs lg:col-span-2">
            <h3 className="text-base font-bold text-slate-900 m-0">Recent Expenses Logs</h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">Real-time entries from your database</p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full border-collapse text-left text-sm table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 font-semibold w-1/3">Description</th>
                    <th className="pb-3 font-semibold w-1/4">Category (AI)</th>
                    <th className="pb-3 font-semibold text-right w-1/4">Amount</th>
                    <th className="pb-3 font-semibold text-center w-1/6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400 italic">No recent transactions available.</td>
                    </tr>
                  ) : (
                    recentExpenses.map((exp) => {
                      const colors = categoryColors[exp.category] || categoryColors.Other;
                      return (
                        <tr key={exp._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 font-medium text-slate-900 truncate max-w-[120px]">{exp.description}</td>
                          <td className="py-3.5">
                            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 border rounded-full tracking-wide truncate max-w-[100px] ${colors.bg} ${colors.text}`}>
                              {exp.category || "Other"}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-bold text-slate-900 truncate">
                            {formatAdvancedAmount(exp.amount)}
                          </td>
                          <td className="py-3.5 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp._id)}
                              disabled={deletingId === exp._id}
                              className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer hover:bg-red-100/70 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                              {deletingId === exp._id ? "..." : "Delete"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="text-center p-5 text-xs text-slate-400 border-t border-slate-200 bg-white mt-auto">
        &copy; {new Date().getFullYear()} Smart Budget Analyzer. Academic Capstone Project.
      </footer>
    </div>
  );
}