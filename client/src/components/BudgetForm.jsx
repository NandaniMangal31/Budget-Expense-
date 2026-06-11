import { useState, useEffect } from "react";
import API from "../services/api";

export default function BudgetForm({ userId, onBudgetUpdated }) {
  const [totalBudget, setTotalBudget] = useState("");
  const [foodTarget, setFoodTarget] = useState("");
  const [travelTarget, setTravelTarget] = useState("");
  const [shoppingTarget, setShoppingTarget] = useState("");
  const [billsTarget, setBillsTarget] = useState("");
  const [entTarget, setEntTarget] = useState("");

  const handleSaveBudget = async () => {
    try {
      await API.post("/budgets/set", {
        userId,
        totalBudget: totalBudget || "0",
        categoryTargets: {
          "Food & Drinks": foodTarget || "0",
          "Travel & Transport": travelTarget || "0",
          "Shopping": shoppingTarget || "0",
          "Bills & Utilities": billsTarget || "0",
          "Entertainment": entTarget || "0"
        }
      });
      alert("Custom budget rules locked successfully! 🏆");
      if (onBudgetUpdated) onBudgetUpdated();
    } catch (err) {
      alert("Failed to save personal tracking milestones.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-slate-900 m-0 mb-1">🎯 Customize Your Financial Targets</h3>
      <p className="text-xs text-slate-500 m-0 mb-4">Set your total monthly cap and map out limits for specific categories (Supports Lakh, Cr phrases).</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-600">Total Monthly Budget (Overall Target)</label>
          <input type="text" placeholder="e.g., 2 Lakh or 50000" value={totalBudget} onChange={(e)=>setTotalBudget(e.target.value)} className="px-3 py-2 text-sm border rounded-md outline-none focus:border-blue-500"/>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">🍔 Food Target</label>
          <input type="text" placeholder="e.g., 10000" value={foodTarget} onChange={(e)=>setFoodTarget(e.target.value)} className="px-3 py-2 text-sm border rounded-md outline-none"/>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">乘坐 Travel Target</label>
          <input type="text" placeholder="e.g., 5000" value={travelTarget} onChange={(e)=>setTravelTarget(e.target.value)} className="px-3 py-2 text-sm border rounded-md outline-none"/>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">🛍️ Shopping Target</label>
          <input type="text" placeholder="e.g., 15000" value={shoppingTarget} onChange={(e)=>setShoppingTarget(e.target.value)} className="px-3 py-2 text-sm border rounded-md outline-none"/>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">🎬 Entertainment Target</label>
          <input type="text" placeholder="e.g., 4000" value={entTarget} onChange={(e)=>setEntTarget(e.target.value)} className="px-3 py-2 text-sm border rounded-md outline-none"/>
        </div>
      </div>
      
      <div className="flex justify-end mt-4">
        <button onClick={handleSaveBudget} className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md border-none hover:bg-emerald-700 transition-colors cursor-pointer">
          💾 Save Targets
        </button>
      </div>
    </div>
  );
}