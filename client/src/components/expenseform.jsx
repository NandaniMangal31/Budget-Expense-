import { useState } from "react";
import API from "../services/api";

export default function ExpenseForm({ refresh }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food & Drinks");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const parseAmount = (input) => {
    const lower = input.toLowerCase();
    if (lower.includes("lakh")) return parseFloat(lower) * 100000;
    if (lower.includes("cr")) return parseFloat(lower) * 10000000;
    if (lower.includes("m")) return parseFloat(lower) * 1000000;
    if (lower.includes("k")) return parseFloat(lower) * 1000;
    return parseFloat(lower);
  };

  const addExpense = async () => {
    if (!amount || !description) {
      alert("Please fill out the Amount and Description fields.");
      return;
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const userId = storedUser?._id;
      if (!userId) {
        alert("Please re-login.");
        return;
      }

      await API.post("/expenses/add", {
        userId,
        amount: parseAmount(amount.trim()),
        description: description.trim(),
        category,
        date,
      });

      setAmount("");
      setDescription("");
      setCategory("Food & Drinks");
      setDate(new Date().toISOString().split("T")[0]);

      alert("Expense successfully added! 🎉");
      if (refresh) refresh();
    } catch (error) {
      console.error("Form Submission Error:", error);
      alert(error.response?.data?.msg || "Failed to log expense.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto mb-6">
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold">Manual Expense Log Form</h3>
        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label>Expense Amount (₹)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded-md px-3 py-2">
              <option value="Food & Drinks">🍔 Food & Drinks</option>
              <option value="Travel & Transport">🚌 Travel & Transport</option>
              <option value="Shopping">🛍️ Shopping</option>
              <option value="Bills & Utilities">🧾 Bills & Utilities</option>
              <option value="Entertainment">🎬 Entertainment</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={addExpense} className="bg-blue-600 text-white px-5 py-2 rounded-md">
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
