import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import ExpenseForm from "./expenseform.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [userMetadata, setUserMetadata] = useState({ name: "User" });
  const [deletingId, setDeletingId] = useState(null);

  const monthlyBudget = 1000; 

  // Database se user metadata aur expenses fetch karne ka pipeline
useEffect(() => {
  const fetchExpenses = async () => {
    try {
      // 1. Storage check pipeline configurations
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      // 🛡️ TOKEN GUARD LOCK: Agar login token ya user nahi mila, toh call yahin rok do (Bypass 401 Loop)
      if (!storedUser || !token) {
        console.log("Auth session variables missing from storage. Waiting...");
        return;
      }

      // 2. Safe parsing without deep object chaining loops
      const userData = JSON.parse(storedUser);

      // 🎯 CRITICAL FIX: Direct object mapping mapping structure alignment
      if (userData?.name) {
        setUserMetadata({ name: userData.name });
      }

      // 3. Extracted safe MongoDB ID string query reference
      const userId = userData?._id;
      if (!userId) {
        console.error("User ID structure is missing in payload config.");
        return;
      }

      // 🚀 Core secure get request (Now headers automatically added via axios interceptor)
      const res = await API.get(`/expenses/${userId}`);
      
      if (res.data) {
        setExpenses(res.data);
      }
    } catch (err) {
      console.error("Dashboard Expense Fetch Layer Exception Error:", err);
    }
  };

  fetchExpenses();
}, []); // Empty dependency array captures fresh storage states on cluster mount

  // Naya expense add hone ke baad list ko refresh karne ke liye helper function
const refreshExpenses = async () => {
  const storedUser = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  // 🛡️ SECURITY GUARD: Agar user data ya token storage me nahi hai, toh call block karo
  if (!storedUser || !token) {
    console.log("Session details missing from storage. Aborting refresh.");
    return;
  }

  try {
    const user = JSON.parse(storedUser);

    // 🎯 CRITICAL FIX: Nesting ko tod kar sidhe user._id access karein
    const userId = user?._id;

    if (!userId) {
      console.error("User ID structure is missing in payload!");
      return;
    }

    // 🚀 Secure dynamic endpoint call (Headers handle ho rahe hain axios interceptor se)
    const res = await API.get(`/expenses/${userId}`);
    
    if (res.data) {
      setExpenses(res.data);
    }
  } catch (err) {
    console.log("Error refreshing logs:", err);
  }
};

  // Budget calculations
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remainingBudget = monthlyBudget - totalExpenses;

  // Real-time AI categorization distribution aggregate mapping
  const categoryTotals = expenses.reduce((acc, curr) => {
    const cat = curr.category || "Other";
    acc[cat] = (acc[cat] || 0) + Number(curr.amount || 0);
    return acc;
  }, {});

  const categoryColors = {
    "Food & Drinks": { dot: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    "Travel & Transport": { dot: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    "Shopping": { dot: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
    "Bills & Utilities": { dot: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    "Entertainment": { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50 border-red-100" },
    "Other": { dot: "bg-slate-500", text: "text-slate-600", bg: "bg-slate-50 border-slate-100" },
    "Others": { dot: "bg-slate-500", text: "text-slate-600", bg: "bg-slate-50 border-slate-100" }
  };

  // 🗑️ Budget Delete Request Control Pipeline (Optimized for instant UI removal)
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Bhai, kya aap sach me yeh expense log delete karna chahte ho?")) return;

    try {
      setDeletingId(expenseId);
      
      // Backend core API call trigger execution
      await API.delete(`/expenses/${expenseId}`);
      
      // State filtered using deep dependency cleanup for bulletproof re-rendering
      setExpenses((prevExpenses) => prevExpenses.filter((item) => item._id !== expenseId));
      
      alert("Expense log successfully deleted!");
    } catch (err) {
      console.error("Deletion Pipeline Failure:", err);
      alert("Failed to delete the log tracker record.");
    } finally {
      setDeletingId(null);
    }
  };

  // Safe Extraction Layer: Hamesha dynamic slice rendering framework maintain karne ke liye
  const recentExpenses = expenses.length > 0 ? [...expenses].slice(-5).reverse() : [];

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans flex flex-col antialiased">
      
      {/* 1. TOP NAVBAR */}
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
              👤 Student Account
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
        
        {/* 2. WELCOME BANNER */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 m-0">
              Welcome Back, {userMetadata.name}!
            </h1>
            <p className="text-sm text-slate-400 mt-1 m-0">
              Here is an overview of your college academic year budget analytics tracker.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
            MERN + OpenAI Pipeline
          </div>
        </div>

        {/* 3. AI EXPENDITURE INPUT LOG FORM ELEMENT CONTAINER */}
        <ExpenseForm refresh={refreshExpenses} />

        {/* 4. METRIC CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Monthly Allocation</p>
            <p className="text-3xl font-extrabold text-slate-900 my-2">₹{monthlyBudget.toLocaleString()}</p>
            <div className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-600 w-fit">🎯 Target Base</div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Total Expenses</p>
            <p className="text-3xl font-extrabold text-slate-900 my-2">₹{totalExpenses.toLocaleString()}</p>
            <div className="text-xs font-semibold px-2 py-1 rounded bg-red-50 text-red-600 w-fit">💸 Outgoing Logs</div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Remaining Balance</p>
            <p className={`text-3xl font-extrabold my-2 ${remainingBudget < 0 ? "text-red-600" : "text-emerald-600"}`}>
              ₹{remainingBudget.toLocaleString()}
            </p>
            <div className={`text-xs font-semibold px-2 py-1 rounded w-fit ${
              remainingBudget < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {remainingBudget < 0 ? "⚠️ Overbudget" : "🚀 Safe Limit"}
            </div>
          </div>
        </div>

        {/* 5. DATA SPLIT SECTION MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Analytics Distribution Bars */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs lg:col-span-1">
            <h3 className="text-base font-bold text-slate-900 m-0">Category Analysis</h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">Distribution across budget heads</p>

            {expenses.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400 font-medium italic">No expense records found.</div>
            ) : (
              <div className="flex flex-col gap-4 mt-4">
                {Object.entries(categoryTotals).map(([category, amount]) => {
                  const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : 0;
                  const colors = categoryColors[category] || categoryColors.Other;
                  return (
                    <div key={category}>
                      <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className={`w-2.5 h-2.5 rounded-full inline-block ${colors.dot}`}></span>
                          {category}
                        </span>
                        <span className="font-semibold text-slate-900">{percentage}% (₹{amount})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors.dot}`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table Container Display Layer Module */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs lg:col-span-2">
            <h3 className="text-base font-bold text-slate-900 m-0">Recent Expenses Logs</h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">Real-time entries from your database</p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold">Category (AI)</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-center">Actions</th>
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
                          <td className="py-3.5 font-medium text-slate-900">{exp.description}</td>
                          <td className="py-3.5">
                            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 border rounded-full tracking-wide ${colors.bg} ${colors.text}`}>
                              {exp.category || "Other"}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-bold text-slate-900">
                            ₹{Number(exp.amount).toLocaleString()}
                          </td>
                          <td className="py-3.5 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp._id)}
                              disabled={deletingId === exp._id}
                              className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer hover:bg-red-100/70 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                              {deletingId === exp._id ? "Deleting..." : "Delete"}
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