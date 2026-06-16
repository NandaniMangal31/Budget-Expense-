export default function CategoryAnalysis({ expenses, categoryTotals, totalExpenses, budgetConfig, parseSafeAmount, getCategoryStyles, formatAdvancedAmount }) {
  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <h3 className="text-base font-bold">Category Analysis</h3>
      {expenses.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">No expense records found.</div>
      ) : (
        <div className="flex flex-col gap-4 mt-4">
          {Object.entries(categoryTotals).map(([category, amount]) => {
            const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : 0;
            const colors = getCategoryStyles(category);
            const target = budgetConfig.categoryTargets?.[category] || "0";
            const targetNum = parseSafeAmount(target);
            const isBreached = targetNum > 0 && amount > targetNum;
            return (
              <div key={category}>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`}></span>{category}</span>
                  <span className={isBreached ? "text-red-600 font-bold" : "font-bold"}>{formatAdvancedAmount(amount)} / {targetNum > 0 ? formatAdvancedAmount(target) : "No Cap"}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className={`${isBreached ? "bg-red-500" : colors.dot} h-full rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                </div>
                {isBreached && <p className="text-[10px] text-red-500">⚠️ Allocation breached!</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
