import { useState } from "react";
import API from "../services/api";

export default function ExpenseForm({ refresh }) {
  // Preserved original core states for manual logging mode
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Defaults to today's date

  // 🤖 New System States for managing dynamic AI operations 
  const [aiLoading, setAiLoading] = useState(false);

  // 📸 AUTOMATED SCREENSHOT PROCESSOR ENGINE
const handleScreenshotUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setAiLoading(true);
  const reader = new FileReader();

  reader.onloadend = async () => {
    try {
      // Safety Check: Agar reader crash ya blank ho
      if (!reader.result) {
        throw new Error("File formatting read error occurred internally.");
      }

      // Splitting metadata headers string from buffer binary stream
      const base64String = reader.result.split(",")[1];
      
      if (!base64String) {
        throw new Error("Failed to parse clean base64 data stream.");
      }

      console.log("Triggering network pipeline for mime:", file.type);

      // Hitting the secure AI automation gateway route
      const res = await API.post("/expenses/scan", {
        imageBuffer: base64String,
        mimeType: file.type // Pass exact string data (e.g. 'image/png')
      });

      // SweetAlert ya custom Toast notification lagao toh aur sundar lagega bhai!
      alert(res.data.msg || "AI successfully extracted log details! 🎉");

      // 🔔 BUDGET LIMIT TRIGGER: Display 50%, 80% or 100% notification warnings
      if (res.data.alert) {
        alert(res.data.alert); 
      }

      // Trigger parent panel refresh to re-evaluate dashboard charts
      if (refresh) refresh();

    } catch (error) {
      console.error("AI Upload Pipeline Execution Fault:", error);
      // Backend errors ko display karne ka best framework fallback
      alert(error.response?.data?.msg || error.message || "Failed to analyze screenshot image structure.");
    } finally {
      setAiLoading(false);
      e.target.value = ""; // Flushing selection slot memory to allow uploading same file again
    }
  };

  reader.readAsDataURL(file);
};
  // STANDARD MANUAL EXECUTION METHOD
  const addExpense = async () => {
    if (!amount || !description) {
      alert("Please fill out the Amount and Description fields.");
      return;
    }

    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        alert("Bhai, user session nahi mila! Ek baar re-login karo.");
        return;
      }

      await API.post("/expenses/add", {
        amount: Number(amount), 
        description: description.trim(),
        category, 
        date      
      });

      setAmount("");
      setDescription("");
      setCategory("Food");
      setDate(new Date().toISOString().split('T')[0]);

      alert("Expense successfully added! 🎉");
      
      if (refresh) refresh();

    } catch (error) {
      console.error("Form Submission Failure Error:", error);
      alert(error.response?.data?.msg || "Failed to log expense log.");
    }
  };

  const handleReset = (e) => {
    e.preventDefault();
    setAmount("");
    setDescription("");
    setCategory("Food");
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="max-w-2xl mx-auto mb-6 font-sans flex flex-col gap-6 box-border">
      
      {/* SECTION 1: 🤖 TAILWIND AI AUTOMATION SCANNER MODULE */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🤖</span>
          <h3 className="text-lg font-bold text-slate-900 m-0">AI Instant Scanner Gateway</h3>
        </div>
        <p className="text-xs text-slate-500 m-0 mb-4 leading-relaxed">
          Drop a screenshot of your payment checkout screen or transaction history. AI will read item lines step-by-step, categorize domains, and verify budget thresholds.
        </p>

        {/* Dynamic Drag Drop Slot Interface */}
        <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 transition-all relative ${
          aiLoading ? "border-blue-400 bg-blue-50/50" : "border-slate-300 bg-slate-50 hover:bg-slate-100/80"
        }`}>
          <input 
            type="file" 
            accept="image/*"
            disabled={aiLoading}
            onChange={handleScreenshotUpload}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
          />
          <span className={`text-3xl mb-2 ${aiLoading ? "animate-pulse" : ""}`}>
            {aiLoading ? "⏳" : "📸"}
          </span>
          <p className="text-sm font-semibold text-slate-700 m-0">
            {aiLoading ? "AI analyzing transaction blocks and checking budget..." : "Upload Bill or Receipt Screenshot"}
          </p>
          <span className="text-xs text-slate-400 mt-1">Accepts PNG, JPG or JPEG logs</span>
        </div>
      </div>

      {/* SECTION 2: 💸 TRADITIONAL MANUAL ENTRY FORM MODULE */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">✍️</span>
          <h3 className="text-lg font-bold text-slate-900 m-0">Manual Expense Log Form</h3>
        </div>
        <p className="text-xs text-slate-500 m-0 mb-5 leading-relaxed">
          Prefer entering entries manually? Fill out the standardized tracking details below.
        </p>

        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Expense Amount Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Expense Amount (₹)</label>
            <input
              type="number"
              placeholder="e.g., 250"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md text-slate-900 bg-white outline-none focus:border-blue-500 transition-colors box-border"
            />
          </div>

          {/* Category Dropdown Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md text-slate-900 bg-white outline-none cursor-pointer box-border"
            >
              <option value="Food">🍔 Food & Drinks</option>
              <option value="Travel">🚌 Travel & Transport</option>
              <option value="Shopping">🛍️ Shopping</option>
              <option value="Bills">🧾 Bills & Rent</option>
              <option value="Entertainment">🎬 Entertainment</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>

          {/* Description Field */}
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

          {/* Date Field */}
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

          {/* Form Interactive Action Control Row */}
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