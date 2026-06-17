export default function MetricCards({ totalBudget, totalExpenses, remainingBudget, parsedMonthlyBudget, formatAdvancedAmount }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Monthly Allocation</p>
        <p className="text-xl md:text-2xl font-extrabold text-slate-900 my-1 truncate">
          {formatAdvancedAmount(totalBudget)}
        </p>
        <p className="text-xs text-slate-400 font-medium m-0 truncate">
          Approx: {formatAdvancedAmount(parsedMonthlyBudget / 83, true)} USD
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 w-fit mt-2">🎯 Self-Configured</div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Total Expenses</p>
        <p className="text-xl md:text-2xl font-extrabold text-slate-900 my-1 truncate">
          {formatAdvancedAmount(totalExpenses)}
        </p>
        <p className="text-xs text-slate-400 font-medium m-0 truncate">
          Approx: {formatAdvancedAmount(totalExpenses / 83, true)} USD
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 w-fit mt-2">💸 Outgoing Logs</div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Remaining Balance</p>
        <p className={`text-xl md:text-2xl font-extrabold my-1 truncate ${remainingBudget < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {remainingBudget < 0 ? "-" : ""}{formatAdvancedAmount(Math.abs(remainingBudget))}
        </p>
        <p className="text-xs text-slate-400 font-medium m-0 truncate">
          Approx: {formatAdvancedAmount(Math.abs(remainingBudget) / 83, true)} USD
        </p>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded w-fit mt-2 ${
          remainingBudget < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
        }`}>
          {remainingBudget < 0 ? "⚠️ Overbudget" : "🚀 Safe Limit"}
        </div>
      </div>
    </div>
  );
}