import { useState } from "react";
import API from "../services/api";

export default function ExpenseForm({ refresh }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food & Drinks");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const addExpense = async () => {
    if (!amount || !description) {
      alert("Please fill out the Amount and Description fields.");
      return;
    }

    const flexibleAmountRegex = /^[0-9.]+(\s*(lakh|lk|crore|cr|m|k))?(\s*-\s*[0-9.]+(\s*(lakh|lk|crore|cr|m|k))?)?$/i;
    
    if (!flexibleAmountRegex.test(amount.trim())) {
      alert("Invalid Amount Format! Use pure numbers or suffixes (e.g., 50000, 5 Lakh, 1.5 Cr, 2M) or safe ranges (e.g., 1 Lakh-2 Lakh).");
      return;
    }

    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        alert("Please re-login.");
        return;
      }

      await API.post("/expenses/add", {
        amount: amount.trim(), 
        description: description.trim(),
        category, 
        date      
      });

      setAmount("");
      setDescription("");
      setCategory("Food & Drinks");
      setDate(new Date().toISOString().split('T')[0]);

      alert("Expense successfully added! 🎉");
      if (refresh) refresh();

    } catch (error) {
      console.error("Form Submission Failure Error:", error);
      alert(error.response?.data?.msg || "Failed to log expense.");
    }
  };

  const handleAmountKeyDown = (e) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", " ", "-", "."];
    const isAlphaNumeric = /[a-zA-Z0-9]/.test(e.key);

    if (!isAlphaNumeric && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleReset = (e) => {
    e.preventDefault();
    setAmount("");
    setDescription("");
    setCategory("Food & Drinks");
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="max-w-2xl mx-auto mb-6 font-sans flex flex-col gap-6 box-border w-full">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">✍️</span>
          <h3 className="text-lg font-bold text-slate-900 m-0">Manual Expense Log Form</h3>
        </div>
        <p className="text-xs text-slate-500 m-0 mb-5 leading-relaxed">
          Prefer entering entries manually? Fill out the standardized tracking details below.
        </p>

        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Expense Amount (₹)</label>
            <input
              type="text"
              placeholder="e.g., 5 Lakh, 1.5 Cr, 25000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleAmountKeyDown}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md text-slate-900 bg-white outline-none focus:border-blue-500 transition-colors box-border"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md text-slate-900 bg-white outline-none cursor-pointer box-border"
            >
              <option value="Food & Drinks">🍔 Food & Drinks</option>
              <option value="Travel & Transport">🚌 Travel & Transport</option>
              <option value="Shopping">🛍️ Shopping</option>
              <option value="Bills & Utilities">🧾 Bills & Utilities</option>
              <option value="Entertainment">🎬 Entertainment</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Description</label>
            <input
              type="text"
              placeholder="e.g., College canteen lunch with friends"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md text-slate-900 bg-white outline-none focus:border-blue-500 transition-colors box-border"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Date of Expense</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md text-slate-900 bg-white outline-none focus:border-blue-500 transition-colors box-border"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={handleReset} 
              className="bg-slate-100 text-slate-600 font-semibold text-sm px-4 py-2.5 border border-slate-200 rounded-md hover:bg-slate-200 hover:text-slate-700 transition-all cursor-pointer"
            >
              Reset Fields
            </button>
            <button 
              type="button" 
              onClick={addExpense} 
              className="bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 border-none rounded-md hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              ✨ Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}