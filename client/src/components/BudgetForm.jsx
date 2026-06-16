import { useState } from "react";
import API from "../services/api";

export default function BudgetForm({ userId, onBudgetUpdated }) {
  const [totalBudget, setTotalBudget] = useState("");
  const [foodTarget, setFoodTarget] = useState("");
  const [travelTarget, setTravelTarget] = useState("");
  const [shoppingTarget, setShoppingTarget] = useState("");
  const [billsTarget, setBillsTarget] = useState("");
  const [entTarget, setEntTarget] = useState("");
  const [otherTarget, setOtherTarget] = useState("");

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
          "Entertainment": entTarget || "0",
          "Other": otherTarget || "0",
        },
      });
      alert("Custom budget rules locked successfully! 🏆");
      if (onBudgetUpdated) onBudgetUpdated();
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to save budget.");
    }
  };

  return (
    <div className="bg-white border rounded-xl p-6 shadow-sm mb-6 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold">🎯 Customize Your Financial Targets</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label>Total Monthly Budget</label>
          <input value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} className="border rounded-md px-3 py-2" />
        </div>
        <div><label>🍔 Food Target</label><input value={foodTarget} onChange={(e) => setFoodTarget(e.target.value)} className="border rounded-md px-3 py-2" /></div>
        <div><label>🚗 Travel Target</label><input value={travelTarget} onChange={(e) => setTravelTarget(e.target.value)} className="border rounded-md px-3 py-2" /></div>
        <div><label>🛍️ Shopping Target</label><input value={shoppingTarget} onChange={(e) => setShoppingTarget(e.target.value)} className="border rounded-md px-3 py-2" /></div>
        <div><label>🧾 Bills Target</label><input value={billsTarget} onChange={(e) => setBillsTarget(e.target.value)} className="border rounded-md px-3 py-2" /></div>
        <div><label>🎬 Entertainment Target</label><input value={entTarget} onChange={(e) => setEntTarget(e.target.value)} className="border rounded-md px-3 py-2" /></div>
        <div><label>📦 Other Target</label><input value={otherTarget} onChange={(e) => setOtherTarget(e.target.value)} className="border rounded-md px-3 py-2" /></div>
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={handleSaveBudget} className="bg-emerald-600 text-white px-5 py-2 rounded-md">💾 Save Targets</button>
      </div>
    </div>
  );
}
