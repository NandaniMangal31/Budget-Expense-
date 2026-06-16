export default function CategoryAnalysis({ expenses, categoryTotals, totalExpenses, budgetConfig, parseSafeAmount, getCategoryStyles, formatAdvancedAmount }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs lg:col-span-1">
      <h3 className="text-base font-bold text-slate-900 m-0">Category Analysis</h3>
      <p className="text-xs text-slate-400 mt-0.5 m-0">Distribution and budget health indicators</p>

      {expenses.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400 font-medium italic">No expense records found.</div>
      ) : (
        <div className="flex flex-col gap-4 mt-4">
          {Object.entries(categoryTotals).map(([category, amount]) => {
            const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : 0;
            const colors = getCategoryStyles(category);
            
            const matchingBudgetCard = budgetConfig.categoryTargets?.[category] || "0";
            const specificTargetNum = parseSafeAmount(matchingBudgetCard);
            const isBreached = specificTargetNum > 0 && amount > specificTargetNum;

            return (
              <div key={category} className="p-1 rounded-md">
                <div className="flex justify-between items-center text-xs text-slate-600 mb-1 gap-2">
                  <span className="flex items-center gap-1.5 font-medium truncate">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${colors.dot}`}></span>
                    <span className="truncate">{category}</span>
                  </span>
                  <span className={`font-bold shrink-0 ${isBreached ? "text-red-600" : "text-slate-900"}`}>
                    {formatAdvancedAmount(amount)} / {specificTargetNum > 0 ? formatAdvancedAmount(matchingBudgetCard) : "No Cap"}
                  </span>
                </div>
                
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${isBreached ? "bg-red-500" : colors.dot}`} 
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  ></div>
                </div>
                
                {isBreached && (
                  <p className="text-[10px] text-red-500 font-semibold m-0 mt-0.5 animate-pulse">⚠️ Allocation breached!</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}