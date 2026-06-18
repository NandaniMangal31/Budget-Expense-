import { useEffect, useState, useCallback, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import ExpenseForm from "./expenseform.jsx";
import { AuthContext } from "../context/AuthContext";

// Import Custom Modularized Architecture Components
import BudgetModal from "./BudgetModal";
import MetricCards from "./MetricCards";
import CategoryAnalysis from "./CategoryAnalysis";
import ExpenseLogsTable from "./ExpenseLogsTable";
import ReceivedLogsTable from "./ReceivedLogsTable";
import ProfileModal from "./ProfileModal";

// Helper safely extracted outside component cycle to avoid redundant re-initialization
const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [expenses, setExpenses] = useState([]);
  const [uploading, setUploading] = useState(false);

  // BUDGET ENGINE STATES
  const [budgetConfig, setBudgetConfig] = useState({
    totalBudget: "0",
    categoryTargets: {},
  });
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDeletingAllReceived, setIsDeletingAllReceived] = useState(false);

  const [targetInputs, setTargetInputs] = useState({
    totalBudget: "",
    "Food & Drinks": "",
    "Travel & Transport": "",
    Shopping: "",
    "Bills & Utilities": "",
    Entertainment: "",
    Other: "",
  });

  // Extract static user metadata safely outside state cycles
  const cachedUser = useMemo(() => getStoredUser(), []);
  const userId = cachedUser?._id || "";
  const userMetadata = useMemo(
    () => ({
      name: cachedUser?.name || "User",
    }),
    [cachedUser],
  );

  // ==========================================
  // ⚡ AUTOMATED HYBRID PARSING ENGINE
  // ==========================================
  const parseSafeAmount = useCallback((amountVal) => {
    if (amountVal === undefined || amountVal === null) return 0;

    let str = amountVal.toString().toLowerCase().replace(/,/g, "").trim();
    if (str.includes("-")) str = str.split("-")[0].trim();

    let multiplier = 1;

    if (str.includes("lakh") || str.includes("lk")) multiplier = 100000;
    else if (str.includes("crore") || str.includes("cr")) multiplier = 10000000;
    else if (str.includes("qi")) multiplier = 1e18;
    else if (str.includes("qa")) multiplier = 1e15;
    else if (str.includes("t")) multiplier = 1e12;
    else if (str.includes("b")) multiplier = 1e9;
    else if (str.includes("m")) multiplier = 1e6;
    else if (str.includes("k")) multiplier = 1000;

    str = str.replace(/lakh|lk|crore|cr|qi|qa|t|b|m|k/g, "").trim();
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val * multiplier;
  }, []);

  // ==========================================
  // 🎯 THE THREE-IN-ONE HYBRID FORMATTING ENGINE
  // ==========================================
  const formatAdvancedAmount = useCallback((amount) => {
    const num = Number(amount);
    if (isNaN(num)) return "₹0.00";

    const absNum = Math.abs(num);
    const sign = num < 0 ? "-" : "";

    if (!isFinite(num)) return `${sign}₹Infinite`;

    const internationalTiers = [
      { value: 1e18, symbol: "Qi" },
      { value: 1e15, symbol: "Qa" },
      { value: 1e12, symbol: "T" },
      { value: 1e9, symbol: "B" },
    ];

    for (let i = 0; i < internationalTiers.length; i++) {
      if (absNum >= internationalTiers[i].value) {
        const formatted = (absNum / internationalTiers[i].value).toFixed(2);
        return `${sign}₹${formatted} ${internationalTiers[i].symbol}`;
      }
    }

    if (absNum >= 1e7) {
      return `${sign}₹${(absNum / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
    }
    if (absNum >= 1e5) {
      return `${sign}₹${(absNum / 1e5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Lakh`;
    }

    return `${sign}₹${absNum.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, []);

  // ==========================================
  // 🚀 PIPELINE LAYER DATA SYNCING
  // ==========================================
  const fetchDashboardData = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (!storedUser || !token) return;

      const currentUserId = JSON.parse(storedUser)?._id;
      if (!currentUserId) return;

      // Execute data queries concurrently
      const [resExpenses, resBudget] = await Promise.allSettled([
        API.get(`/expenses/${currentUserId}`),
        API.get(`/budgets/${currentUserId}`),
      ]);

      if (resExpenses.status === "fulfilled" && resExpenses.value.data) {
        setExpenses(resExpenses.value.data);
      }

      if (resBudget.status === "fulfilled" && resBudget.value.data) {
        const budgetData = resBudget.value.data;
        setBudgetConfig(budgetData);
        setTargetInputs({
          totalBudget: budgetData.totalBudget || "",
          "Food & Drinks": budgetData.categoryTargets?.["Food & Drinks"] || "",
          "Travel & Transport":
            budgetData.categoryTargets?.["Travel & Transport"] || "",
          Shopping: budgetData.categoryTargets?.["Shopping"] || "",
          "Bills & Utilities":
            budgetData.categoryTargets?.["Bills & Utilities"] || "",
          Entertainment: budgetData.categoryTargets?.["Entertainment"] || "",
          Other: budgetData.categoryTargets?.["Other"] || "",
        });
      }
    } catch (err) {
      console.error("Dashboard synchronization error:", err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  // Add a clean initialization function inside your Main Component / Dashboard Layout
  useEffect(() => {
    const checkSessionAuthorization = () => {
      const activeToken = localStorage.getItem("token");

      // 🛡️ Guardrail: If no token exists, send the user back to the login page immediately
      if (!activeToken) {
        console.warn("No active token discovered. Routing back to gateway.");
        localStorage.clear();
        window.location.href = "/login"; // Updates window matrix down to login gateway route
      }
    };

    checkSessionAuthorization();
  }, []);

  const refreshExpenses = async () => {
    if (!userId) return;
    try {
      const res = await API.get(`/expenses/${userId}`);
      if (res.data) setExpenses(res.data);
    } catch (err) {
      console.error("Failed to refresh logs:", err);
    }
  };

const handleUniversalFileScan = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileNameLower = file.name.toLowerCase();
  
  // 🛡️ Guardrail: Stop users early if they upload obvious configuration/help sheets
  if (fileNameLower.includes("- settings") || fileNameLower.includes("- help") || fileNameLower.includes("- copy")) {
    alert("⚠️ Sheet Mismatch Detected\nIt looks like you uploaded a Settings or Help sheet. Please choose the sheet containing your actual transaction entries (e.g., Register or Ledger).");
    e.target.value = "";
    return;
  }

  const fileExtension = file.name.split(".").pop().toLowerCase();
  const allowedExtensions = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "pdf",
    "xlsx",
    "xls",
    "csv",
    "docx",
    "doc",
    "rtf",
    "txt",
  ];

  if (!allowedExtensions.includes(fileExtension)) {
    alert(
      `❌ Unsupported File Type (${file.name})\n\nAllowed formats:\nImages (jpg, png, webp, gif)\nPDF\nWord (doc, docx)\nExcel (xls, xlsx, csv)\nText (txt, rtf)`,
    );
    e.target.value = "";
    return;
  }

  setUploading(true);
  try {
    const formData = new FormData();
    formData.append("file", file);

    const activeToken = localStorage.getItem("token");

    const res = await API.post("/expenses/scan", formData, {
      headers: {
        ...(activeToken && { Authorization: `Bearer ${activeToken}` }),
      },
      // Large PDFs/images may need extra time for OCR processing
      timeout: 120000,
    });

    const serverSuccessOutput = res.data?.msg || res.data?.message || "Document processed successfully!";
    const fileKind = res.data?.summary?.fileKind || fileExtension;
    const expensesImported =
      res.data?.summary?.expensesCount ??
      res.data?.data?.filter((item) => item.transactionType !== "received").length ??
      0;
    const receivedImported = res.data?.summary?.receivedCount ?? 0;

    alert(
      `🎉 ${serverSuccessOutput}\n\nFile type: ${fileKind}\nExpenses imported: ${expensesImported}\nReceived imported: ${receivedImported}`,
    );

    if (typeof refreshExpenses === 'function') {
      await refreshExpenses();
    }
  } catch (apiErr) {
    console.error("🚨 API Engine Communication Error Trace:", apiErr);
    
    const serverErrMsg = 
      apiErr.response?.data?.msg || 
      apiErr.response?.data?.message || 
      apiErr.response?.data?.error;

    // 🎯 FIX: Clear user notification if a file contains zero transaction entries
    if (apiErr.response?.status === 400) {
      alert(`⚠️ Scan Warning: ${serverErrMsg}\n\nTip: Ensure the document contains visible numeric columns with clear transaction amounts or values.`);
    } else {
      alert(`❌ Upload Failure: ${serverErrMsg || "File processing execution parameters failed. Verify server cluster log files."}`);
    }
  } finally {
    setUploading(false);
    e.target.value = ""; 
  }
};

  const handleSaveBudgetConfig = async () => {
    if (!userId) return;
    try {
      const payload = {
        userId,
        totalBudget: targetInputs.totalBudget || "0",
        categoryTargets: {
          "Food & Drinks": targetInputs["Food & Drinks"] || "0",
          "Travel & Transport": targetInputs["Travel & Transport"] || "0",
          Shopping: targetInputs["Shopping"] || "0",
          "Bills & Utilities": targetInputs["Bills & Utilities"] || "0",
          Entertainment: targetInputs["Entertainment"] || "0",
          Other: targetInputs["Other"] || "0",
        },
      };
      const res = await API.post("/budgets/set", payload);
      alert(res.data?.msg || "Custom budget metrics locked! 🏆");
      setBudgetConfig(payload);
      setIsBudgetFormOpen(false);
    } catch (err) {
      alert("Failed to synchronize targets.");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this entry?"))
      return;
    try {
      setDeletingId(expenseId);
      await API.delete(`/expenses/${expenseId}`);
      setExpenses((prev) => prev.filter((item) => item._id !== expenseId));
      alert("Entry successfully deleted!");
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllExpenses = async () => {
    if (
      !window.confirm(
        "Delete ALL expense logs? Received/credit entries will be kept.",
      )
    )
      return;
    try {
      setIsDeletingAll(true);
      await API.delete("/expenses/all");
      setExpenses((prev) =>
        prev.filter((item) => item.transactionType === "received"),
      );
      alert("All expense logs deleted!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete all expense logs.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteAllReceived = async () => {
    if (
      !window.confirm(
        "Delete ALL received logs? Expense entries will be kept.",
      )
    )
      return;
    try {
      setIsDeletingAllReceived(true);
      await API.delete("/expenses/received/all");
      setExpenses((prev) =>
        prev.filter((item) => item.transactionType !== "received"),
      );
      alert("All received logs deleted!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete all received logs.");
    } finally {
      setIsDeletingAllReceived(false);
    }
  };

  // ==========================================
  // 📊 OPTIMIZED MEMOIZED CALCULATIONS
  // ==========================================
  const parsedMonthlyBudget = useMemo(
    () => parseSafeAmount(budgetConfig.totalBudget),
    [budgetConfig.totalBudget, parseSafeAmount],
  );

  const expenseLogs = useMemo(
    () => expenses.filter((item) => item.transactionType !== "received"),
    [expenses],
  );

  const receivedLogs = useMemo(
    () => expenses.filter((item) => item.transactionType === "received"),
    [expenses],
  );

  const totalExpenses = useMemo(
    () => expenseLogs.reduce((sum, item) => sum + parseSafeAmount(item.amount), 0),
    [expenseLogs, parseSafeAmount],
  );

  const remainingBudget = useMemo(
    () => parsedMonthlyBudget - totalExpenses,
    [parsedMonthlyBudget, totalExpenses],
  );

  const categoryTotals = useMemo(() => {
    return expenseLogs.reduce((acc, curr) => {
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
  }, [expenseLogs, parseSafeAmount]);

  const displayExpenses = useMemo(
    () => (expenseLogs.length > 0 ? [...expenseLogs].reverse() : []),
    [expenseLogs],
  );

  const displayReceived = useMemo(
    () => (receivedLogs.length > 0 ? [...receivedLogs].reverse() : []),
    [receivedLogs],
  );

  const getCategoryStyles = useCallback((categoryName) => {
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
    if (normalized.includes("healthcare") || normalized.includes("health"))
      return {
        dot: "bg-rose-500",
        text: "text-rose-700",
        bg: "bg-rose-50 border-rose-100",
      };
    if (normalized.includes("insurance"))
      return {
        dot: "bg-indigo-500",
        text: "text-indigo-700",
        bg: "bg-indigo-50 border-indigo-100",
      };
    if (normalized.includes("investment"))
      return {
        dot: "bg-violet-500",
        text: "text-violet-700",
        bg: "bg-violet-50 border-violet-100",
      };
    if (normalized.includes("cash withdrawal") || normalized.includes("atm"))
      return {
        dot: "bg-stone-500",
        text: "text-stone-700",
        bg: "bg-stone-50 border-stone-100",
      };
    if (normalized.includes("transfer"))
      return {
        dot: "bg-sky-500",
        text: "text-sky-700",
        bg: "bg-sky-50 border-sky-100",
      };
    if (normalized.includes("groceries") || normalized.includes("grocery"))
      return {
        dot: "bg-lime-600",
        text: "text-lime-800",
        bg: "bg-lime-50 border-lime-100",
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
  }, []);

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

      {/* MAIN CONTAINER */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 flex-grow box-border">
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

        {/* AI SMART SCANNER UI BLOCK */}
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
                Images · PDF · Word · Excel · CSV · TXT · RTF
              </span>
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.xlsx,.xls,.csv,.doc,.docx,.rtf,.txt,image/*,application/pdf"
              onChange={handleUniversalFileScan}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        <ExpenseForm refresh={refreshExpenses} />

        <MetricCards
          totalBudget={budgetConfig.totalBudget || "0"}
          totalExpenses={totalExpenses}
          remainingBudget={remainingBudget}
          parsedMonthlyBudget={parsedMonthlyBudget}
          formatAdvancedAmount={formatAdvancedAmount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
          <div className="lg:col-span-2 w-full">
            <CategoryAnalysis
              expenses={expenseLogs}
              categoryTotals={categoryTotals}
              totalExpenses={totalExpenses}
              budgetConfig={budgetConfig}
              parseSafeAmount={parseSafeAmount}
              getCategoryStyles={getCategoryStyles}
              formatAdvancedAmount={formatAdvancedAmount}
            />
          </div>
          <div className="w-full flex flex-col gap-6">
            <ExpenseLogsTable
              displayExpenses={displayExpenses}
              getCategoryStyles={getCategoryStyles}
              formatAdvancedAmount={formatAdvancedAmount}
              onDeleteExpense={handleDeleteExpense}
              deletingId={deletingId}
              onDeleteAll={handleDeleteAllExpenses}
              isDeletingAll={isDeletingAll}
            />
            <ReceivedLogsTable
              displayReceived={displayReceived}
              formatAdvancedAmount={formatAdvancedAmount}
              onDeleteExpense={handleDeleteExpense}
              deletingId={deletingId}
              onDeleteAll={handleDeleteAllReceived}
              isDeletingAll={isDeletingAllReceived}
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
