import { useState, useEffect } from "react";

export default function BudgetModal({ isOpen, targetInputs, setTargetInputs, onSave, onClose }) {
  const [validationError, setValidationError] = useState("");

  const totalBudget = parseFloat(targetInputs.totalBudget) || 0;

  const categoriesSum = [
    "Food & Drinks",
    "Travel & Transport",
    "Shopping",
    "Bills & Utilities",
    "Entertainment",
    "Other"
  ].reduce((sum, cat) => sum + (parseFloat(targetInputs[cat]) || 0), 0);

  useEffect(() => {
    if (totalBudget === 0 && categoriesSum > 0) {
      setValidationError("⚠️ Please set your Total Overall Budget first!");
    } else if (categoriesSum > totalBudget) {
      const exceededAmount = categoriesSum - totalBudget;
      setValidationError(
        `❌ Allocation Breached! Your category sum (₹${categoriesSum.toLocaleString()}) exceeds your Total Budget (₹${totalBudget.toLocaleString()}) by ₹${exceededAmount.toLocaleString()}. You cannot allocate more than your overall limit.`
      );
    } else {
      setValidationError(""); 
    }
  }, [targetInputs, totalBudget, categoriesSum]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
          <h3 className="m-0 font-bold text-base tracking-tight">🎯 Setup Budget Targets</h3>
          <button onClick={onClose} className="bg-transparent border-none text-slate-400 hover:text-white cursor-pointer text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto box-border">
          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-semibold leading-relaxed">
              {validationError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">OVERALL TOTAL BUDGET (₹)</label>
            <input 
              type="number" 
              placeholder="e.g. 1000"
              value={targetInputs.totalBudget}
              onChange={(e) => setTargetInputs({ ...targetInputs, totalBudget: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 focus:outline-blue-500 box-border"
            />
            {totalBudget > 0 && (
              <p className="text-[11px] text-slate-400 mt-1 m-0">
                Remaining to allocate: <span className="font-bold text-slate-600">₹{(totalBudget - categoriesSum).toLocaleString()}</span>
              </p>
            )}
          </div>

          <hr className="border-0 border-t border-slate-100 my-4" />
          <p className="text-[11px] font-bold text-slate-400 tracking-wider m-0 uppercase">Category Allocations</p>

          {["Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other"].map((cat) => (
            <div key={cat} className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600 w-1/2 truncate">{cat}</span>
              <input 
                type="number" 
                placeholder="0"
                value={targetInputs[cat] || ""}
                onChange={(e) => setTargetInputs({ ...targetInputs, [cat]: e.target.value })}
                className="w-1/2 px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 text-right focus:outline-blue-500 box-border"
                disabled={totalBudget === 0}
              />
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer hover:bg-slate-100 transition-all">Cancel</button>
          <button 
            onClick={onSave}
            disabled={!!validationError || totalBudget === 0}
            className={`px-5 py-2 rounded-lg text-xs font-bold text-white border-none transition-all cursor-pointer ${
              !!validationError || totalBudget === 0 ? "bg-slate-300 cursor-not-allowed shadow-none" : "bg-blue-600 hover:bg-blue-700 shadow-sm"
            }`}
          >
            Lock Target Config 🏆
          </button>
        </div>
      </div>
    </div>
  );
}