export default function ExpenseLogsTable({ displayExpenses, getCategoryStyles, formatAdvancedAmount, onDeleteExpense, deletingId }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs lg:col-span-2">
      <h3 className="text-base font-bold text-slate-900 m-0">Recent Expenses Logs</h3>
      <p className="text-xs text-slate-400 mt-0.5 m-0">Real-time entries from your database</p>

      <div className="overflow-y-auto max-h-[380px] mt-4 pr-1 scrollbar-thin">
        <table className="w-full border-collapse text-left text-sm table-fixed">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <th className="pb-3 font-semibold w-1/3 bg-white">Description</th>
              <th className="pb-3 font-semibold w-1/4 bg-white">Category (AI)</th>
              <th className="pb-3 font-semibold text-right w-1/4 bg-white">Amount</th>
              <th className="pb-3 font-semibold text-center w-1/6 bg-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayExpenses.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-8 text-slate-400 italic">No transactions available.</td>
              </tr>
            ) : (
              displayExpenses.map((exp) => {
                let displayCategory = exp.category || "Other";
                if (displayCategory.toLowerCase().trim() === "food") {
                  displayCategory = "Food & Drinks";
                }
                const colors = getCategoryStyles(displayCategory);
                return (
                  <tr key={exp._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 font-medium text-slate-900 truncate max-w-[120px]">{exp.description}</td>
                    <td className="py-3.5">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 border rounded-full tracking-wide truncate max-w-[120px] ${colors.bg} ${colors.text}`}>
                        {displayCategory}
                      </span>
                    </td>
                    <td className="py-3.5 text-right font-bold text-slate-900 truncate">
                      {formatAdvancedAmount(exp.amount)}
                    </td>
                    <td className="py-3.5 text-center">
                      <button
                        onClick={() => onDeleteExpense(exp._id)}
                        disabled={deletingId === exp._id}
                        className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer hover:bg-red-100/70 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        {deletingId === exp._id ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}