export default function MetricCards({
  totalBudget,
  totalExpenses,
  remainingBudget,
  parsedMonthlyBudget,
  formatAdvancedAmount,
  conversionRate = 83, // ✅ configurable instead of hardcoded
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Monthly Allocation */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase">Monthly Allocation</p>
        <p className="text-xl md:text-2xl font-extrabold text-slate-900 my-1 truncate">
          {formatAdvancedAmount(totalBudget)}
        </p>
        <p className="text-xs text-slate-400">
          Approx: {formatAdvancedAmount(parsedMonthlyBudget / conversionRate, true)} USD
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 w-fit mt-2">
          🎯 Self-Configured
        </div>
      </div>

      {/* Total Expenses */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase">Total Expenses</p>
        <p className="text-xl md:text-2xl font-extrabold text-slate-900 my-1 truncate">
          {formatAdvancedAmount(totalExpenses)}
        </p>
        <p className="text-xs text-slate-400">
          Approx: {formatAdvancedAmount(totalExpenses / conversionRate, true)} USD
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 w-fit mt-2">
          💸 Outgoing Logs
        </div>
      </div>

      {/* Remaining Balance */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase">Remaining Balance</p>
        <p
          className={`text-xl md:text-2xl font-extrabold my-1 truncate ${
            remainingBudget < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {remainingBudget < 0
            ? `Over by ${formatAdvancedAmount(Math.abs(remainingBudget))}`
            : formatAdvancedAmount(remainingBudget)}
        </p>
        <p className="text-xs text-slate-400">
          Approx: {formatAdvancedAmount(Math.abs(remainingBudget) / conversionRate, true)} USD
        </p>
        <div
          className={`text-xs font-semibold px-2 py-0.5 rounded w-fit mt-2 ${
            remainingBudget < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {remainingBudget < 0 ? "⚠️ Overbudget" : "🚀 Safe Limit"}
        </div>
      </div>
    </div>
  );
}
