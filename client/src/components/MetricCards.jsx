export default function MetricCards({
  totalBudget,
  totalExpenses,
  totalIncome = 0,
  netSavings = 0,
  remainingBudget,
  parsedMonthlyBudget,
  formatAdvancedAmount,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
      <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Monthly Allocation</p>
        <p className="text-lg md:text-2xl font-extrabold text-slate-900 my-1 truncate">
          {formatAdvancedAmount(totalBudget)}
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 w-fit mt-2">Budget</div>
      </div>

      <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Total Expenses</p>
        <p className="text-lg md:text-2xl font-extrabold text-red-600 my-1 truncate">
          {formatAdvancedAmount(totalExpenses)}
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 w-fit mt-2">Outgoing</div>
      </div>

      <div className="bg-white p-5 md:p-6 rounded-xl border border-emerald-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider m-0">Total Income</p>
        <p className="text-lg md:text-2xl font-extrabold text-emerald-700 my-1 truncate">
          {formatAdvancedAmount(totalIncome)}
        </p>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 w-fit mt-2">Received</div>
      </div>

      <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Net Savings</p>
        <p className={`text-lg md:text-2xl font-extrabold my-1 truncate ${netSavings < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {netSavings < 0 ? "-" : ""}{formatAdvancedAmount(Math.abs(netSavings))}
        </p>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded w-fit mt-2 ${
          netSavings < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
        }`}>
          {netSavings < 0 ? "Deficit" : "Surplus"}
        </div>
      </div>

      <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-2xs overflow-hidden sm:col-span-2 lg:col-span-1 xl:col-span-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider m-0">Budget Remaining</p>
        <p className={`text-lg md:text-2xl font-extrabold my-1 truncate ${remainingBudget < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {remainingBudget < 0 ? "-" : ""}{formatAdvancedAmount(Math.abs(remainingBudget))}
        </p>
        <p className="text-[10px] text-slate-400 m-0 mt-1">
          {parsedMonthlyBudget > 0
            ? `${Math.round((totalExpenses / parsedMonthlyBudget) * 100)}% utilized`
            : "Set a budget to track utilization"}
        </p>
      </div>
    </div>
  );
}
