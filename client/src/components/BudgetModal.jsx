import { useState, useEffect } from "react";

export default function BudgetModal({ isOpen, targetInputs, setTargetInputs, onSave, onClose }) {
  const [validationError, setValidationError] = useState("");

  const totalBudget = parseFloat(targetInputs.totalBudget) || 0;
  const categoriesSum = ["Food & Drinks","Travel & Transport","Shopping","Bills & Utilities","Entertainment","Other"]
    .reduce((sum, cat) => sum + (parseFloat(targetInputs[cat]) || 0), 0);

  useEffect(() => {
    if (totalBudget === 0 && categoriesSum > 0) {
      setValidationError("⚠️ Please set your Total Overall Budget first!");
    } else if (categoriesSum > totalBudget) {
      setValidationError(`❌ Allocation Breached! Categories exceed total budget.`);
    } else {
      setValidationError("");
    }
  }, [targetInputs, totalBudget, categoriesSum]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl">
        <div className="bg-slate-900 p-5 text-white flex justify-between">
          <h3 className="font-bold">🎯 Setup Budget Targets</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-4">
          {validationError && <div className="bg-red-50 border text-red-700 p-3 rounded">{validationError}</div>}
          <div>
            <label>Total Budget (₹)</label>
            <input type="number" value={targetInputs.totalBudget} onChange={(e) => setTargetInputs({ ...targetInputs, totalBudget: e.target.value })} className="border rounded px-3 py-2 w-full" />
          </div>
          {["Food & Drinks","Travel & Transport","Shopping","Bills & Utilities","Entertainment","Other"].map((cat) => (
            <div key={cat} className="flex justify-between">
              <span>{cat}</span>
              <input type="number" value={targetInputs[cat] || ""} onChange={(e) => setTargetInputs({ ...targetInputs, [cat]: e.target.value })} className="border rounded px-3 py-2 w-1/2" disabled={totalBudget === 0} />
            </div>
          ))}
        </div>
        <div className="p-4 flex justify-end gap-3">
          <button onClick={onClose}>Cancel</button>
          <button onClick={onSave} disabled={!!validationError || totalBudget === 0}>Lock Target Config 🏆</button>
        </div>
      </div>
    </div>
  );
}
