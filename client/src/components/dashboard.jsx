import { useEffect, useState, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import ExpenseForm from "./expenseform.jsx";

import BudgetModal from "./BudgetModal";
import MetricCards from "./MetricCards";
import CategoryAnalysis from "./CategoryAnalysis";
import ExpenseLogsTable from "./ExpenseLogsTable";
import ProfileModal from "./ProfileModal";
import { AuthContext } from "../context/AuthContext"; // ✅ Added

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext); // ✅ Fixed useContext
  const [expenses, setExpenses] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [budgetConfig, setBudgetConfig] = useState({
    totalBudget: 0,
    categoryTargets: {},
  });
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [targetInputs, setTargetInputs] = useState({
    totalBudget: "",
    "Food & Drinks": "",
    "Travel & Transport": "",
    Shopping: "",
    "Bills & Utilities": "",
    Entertainment: "",
    Other: "",
  });

  const [userId] = useState(() => {
    const storedUser = localStorage.getItem("user");
    try {
      return storedUser ? JSON.parse(storedUser)?._id || "" : "";
    } catch {
      return "";
    }
  });

  const [userMetadata] = useState(() => {
    const storedUser = localStorage.getItem("user");
    try {
      return {
        name: storedUser ? JSON.parse(storedUser)?.name || "User" : "User",
      };
    } catch {
      return { name: "User" };
    }
  });

  const [deletingId, setDeletingId] = useState(null);

  // ==========================================
  // ⚡ AMOUNT PARSER
  // ==========================================
  const parseSafeAmount = (amountVal) => {
    if (amountVal === undefined || amountVal === null) return 0;
    let str = amountVal.toString().toLowerCase().replace(/,/g, "").trim();
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  };

  // ==========================================
  // 🎯 FORMATTER
  // ==========================================
  const formatAdvancedAmount = (amount) => {
    const num = Number(amount);
    if (isNaN(num)) return "₹0.00";
    return `₹${num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ==========================================
  // 🚀 FETCH DASHBOARD DATA
  // ==========================================
  const fetchDashboardData = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (!storedUser || !token) return;

      const currentUserId = JSON.parse(storedUser)?._id;
      if (!currentUserId) return;

      try {
        const resExpenses = await API.get(`/expenses/${currentUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resExpenses.data) setExpenses(resExpenses.data);
      } catch (err) {
        console.error(err.message);
      }

      try {
        const resBudget = await API.get(`/budgets/${currentUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resBudget && resBudget.data) {
          setBudgetConfig(resBudget.data);
          setTargetInputs({
            totalBudget: resBudget.data.totalBudget || "",
            "Food & Drinks":
              resBudget.data.categoryTargets?.["Food & Drinks"] || "",
            "Travel & Transport":
              resBudget.data.categoryTargets?.["Travel & Transport"] || "",
            Shopping: resBudget.data.categoryTargets?.["Shopping"] || "",
            "Bills & Utilities":
              resBudget.data.categoryTargets?.["Bills & Utilities"] || "",
            Entertainment:
              resBudget.data.categoryTargets?.["Entertainment"] || "",
            Other: resBudget.data.categoryTargets?.["Other"] || "",
          });
        }
      } catch {
        console.log("No targets found.");
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refreshExpenses = async () => {
    if (!userId) return;
    try {
      const res = await API.get(`/expenses/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.data) setExpenses(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // ==========================================
  // 📸 UNIVERSAL FILE SCAN
  // ==========================================
  const handleUniversalFileScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      alert(`❌ Unsupported File Type (${file.name})`);
      e.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        const cleanBase64 = base64String.split(",")[1];

        const savedUser = user || JSON.parse(localStorage.getItem("user"));
        const userId = savedUser?._id;

        if (!userId) {
          alert("User ID missing. Please log in again.");
          setUploading(false);
          return;
        }

        const payload = {
          imageBuffer: cleanBase64,
          mimeType: file.type || "application/octet-stream",
          userId,
          fileName: file.name,
        };

        try {
          const res = await API.post("/expenses/scan", payload, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });

          if (res.data?.success) {
            alert(res.data.msg || "Document processed successfully! 🚀");
            refreshExpenses();
          } else {
            alert("Document processed safely!");
            refreshExpenses();
          }
        } catch (apiErr) {
          console.error("API Scanner Error:", apiErr);
          alert(apiErr.response?.data?.msg || "File parsing failed.");
        } finally {
          setUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("FileReader Initialization Error:", err);
      alert("Failed to initialize file ingestion.");
      setUploading(false);
    }
  };

  // ==========================================
  // 💾 SAVE BUDGET CONFIG
  // ==========================================
  const handleSaveBudgetConfig = async () => {
    if (!userId) return;
    try {
      const payload = {
        userId,
        totalBudget: Number(targetInputs.totalBudget) || 0,
        categoryTargets: {
          "Food & Drinks": Number(targetInputs["Food & Drinks"]) || 0,
          "Travel & Transport": Number(targetInputs["Travel & Transport"]) || 0,
          Shopping: Number(targetInputs["Shopping"]) || 0,
          "Bills & Utilities": Number(targetInputs["Bills & Utilities"]) || 0,
          Entertainment: Number(targetInputs["Entertainment"]) || 0,
          Other: Number(targetInputs["Other"]) || 0,
        },
      };
      const res = await API.put("/budgets/set", payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      alert(res.data?.msg || "Budget updated successfully!");
      setBudgetConfig(payload);
      setIsBudgetFormOpen(false);
    } catch (err) {
      alert("Failed to synchronize targets.");
    }
  };

  // ==========================================
  // ❌ DELETE EXPENSE
  // ==========================================
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense?"))
      return;
    try {
      setDeletingId(expenseId);
      await API.delete(`/expenses/${expenseId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setExpenses((prev) => prev.filter((item) => item._id !== expenseId));
      alert("Expense log successfully deleted!");
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  // ==========================================
  // 📊 CALCULATED STRUCTS
  // ==========================================
  const parsedMonthlyBudget = parseSafeAmount(budgetConfig.totalBudget);
  const totalExpenses = expenses.reduce(
    (sum, item) => sum + parseSafeAmount(item.amount),
    0,
  );
  const remainingBudget = parsedMonthlyBudget - totalExpenses;

  const categoryTotals = expenses.reduce((acc, curr) => {
    let cat = curr.category || "Other";
    let normalizedCat = cat.trim();

    if (/^bills$/i.test(normalizedCat)) normalizedCat = "Bills & Utilities";
    else if (/^travel$/i.test(normalizedCat))
      normalizedCat = "Travel & Transport";
    else if (/^food$/i.test(normalizedCat)) normalizedCat = "Food & Drinks";

    acc[normalizedCat] =
      (acc[normalizedCat] || 0) + parseSafeAmount(curr.amount);
    return acc;
  }, {});

  const getCategoryStyles = (categoryName) => {
    const normalized = (categoryName || "").toLowerCase().trim();
    if (normalized.includes("food & drinks"))
      return {
        dot: "bg-blue-500",
        text: "text-blue-600",
        bg: "bg-blue-50 border-blue-100",
      };
    if (
      normalized.includes("travel transport") ||
      normalized.includes("transport")
    )
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-600",
        bg: "bg-emerald-50 border-emerald-100",
      };
    if (normalized.includes("shopping"))
      return {
        dot: "bg-purple-500",
        text: "text-purple-600",
        bg: "bg-purple-50 border-purple-100",
      };
    if (normalized.includes("bill") || normalized.includes("utility"))
      return {
        dot: "bg-amber-500",
        text: "text-amber-600",
        bg: "bg-amber-50 border-amber-100",
      };
    if (normalized.includes("entertainment"))
      return {
        dot: "bg-teal-700",
        text: "text-teal-800",
        bg: "bg-teal-50 border-teal-100",
      };
    if (normalized.includes("other"))
      return {
        dot: "bg-pink-500",
        text: "text-pink-600",
        bg: "bg-pink-50 border-pink-100",
      };
    return {
      dot: "bg-cyan-500",
      text: "text-cyan-700",
      bg: "bg-cyan-100 border-cyan-100",
    };
  };

  const displayExpenses = expenses.length > 0 ? [...expenses].reverse() : [];

  // ==========================================
  // JSX RETURN
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 font-sans flex flex-col antialiased overflow-x-hidden w-full">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => navigate("/")}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">
              SBA
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              SmartBudget
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              👤 <span className="hidden sm:inline">Personal Account</span>
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                navigate("/");
              }}
              className="text-sm font-semibold text-red-600 hover:text-red-800 bg-none border-none cursor-pointer transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN LAYOUT */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 flex-grow box-border">
        {/* BANNER */}
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
            className="text-xs font-bold bg-slate-900 text-white px-4 py-2.5 rounded-lg border-none hover:bg-slate-800 transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            🎯{" "}
            {isBudgetFormOpen ? "Close Control Panel" : "Setup Manual Budgets"}
          </button>
        </div>

        {/* MODALS */}
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userMetadata={userMetadata}
        />
        <BudgetModal
          isOpen={isBudgetFormOpen}
          targetInputs={targetInputs}
          setTargetInputs={setTargetInputs}
          onSave={handleSaveBudgetConfig}
          onClose={() => setIsBudgetFormOpen(false)}
        />

        {/* AI SMART SCANNER */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
          <label className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors group w-full box-border text-center">
            <div className="flex items-center gap-3 text-2xl">
              <span>📸</span> <span className="text-slate-300">|</span>{" "}
              <span>📄</span>
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                {uploading
                  ? "Analyzing File & Auto-Categorizing..."
                  : "Universal AI Smart Scanner: Upload Document or Capture Receipt"}
              </span>
              <span className="block text-xs text-slate-400 mt-1">
                Accepts Image (JPG, JPEG, PNG, WebP) or PDF receipts
              </span>
            </div>
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp, application/pdf"
              onChange={handleUniversalFileScan}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {/* MANUAL EXPENSE FORM */}
        <ExpenseForm refresh={refreshExpenses} />

        {/* METRIC CARDS */}
        <MetricCards
          totalBudget={budgetConfig.totalBudget || 0}
          totalExpenses={totalExpenses}
          remainingBudget={remainingBudget}
          parsedMonthlyBudget={parsedMonthlyBudget}
          formatAdvancedAmount={formatAdvancedAmount}
        />

        {/* CATEGORY + LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
          <div className="lg:col-span-2 w-full">
            <CategoryAnalysis
              expenses={expenses}
              categoryTotals={categoryTotals}
              totalExpenses={totalExpenses}
              budgetConfig={budgetConfig}
              parseSafeAmount={parseSafeAmount}
              getCategoryStyles={getCategoryStyles}
              formatAdvancedAmount={formatAdvancedAmount}
            />
          </div>
          <div className="w-full">
            <ExpenseLogsTable
              displayExpenses={displayExpenses}
              getCategoryStyles={getCategoryStyles}
              formatAdvancedAmount={formatAdvancedAmount}
              onDeleteExpense={handleDeleteExpense}
              deletingId={deletingId}
            />
          </div>
        </div>
      </main>

      <footer className="text-center p-5 text-xs text-slate-400 border-t border-slate-200 bg-white mt-auto w-full">
        &copy; {new Date().getFullYear()} Smart Budget Analyzer. Academic
        Capstone Project.
      </footer>
    </div>
  );
}
