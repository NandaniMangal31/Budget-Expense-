export default function ExpenseLogsTable({ 
  displayExpenses, 
  totalCount = 0,
  page = 1,
  totalPages = 1,
  onPageChange,
  getCategoryStyles, 
  formatAdvancedAmount, 
  onDeleteExpense, 
  deletingId,
  onDeleteAll,
  isDeletingAll,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[430px] w-full overflow-hidden box-border">
      <div className="p-5 border-b border-slate-100 bg-white shrink-0">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 m-0 tracking-tight">Recent Expenses Logs</h3>
            <p className="text-[11px] font-medium text-slate-400 m-0 mt-0.5">Real-time entries stream from database</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {displayExpenses?.length > 0 && onDeleteAll && (
              <button
                type="button"
                onClick={onDeleteAll}
                disabled={isDeletingAll}
                className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors disabled:opacity-50"
              >
                {isDeletingAll ? "Deleting..." : "Delete All"}
              </button>
            )}
            <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-1 rounded-md">
              {totalCount || displayExpenses?.length || 0} Logs
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto overflow-x-auto w-full bg-slate-50/30">
        <table className="w-full border-collapse text-left table-fixed min-w-[300px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 sticky top-0 z-10 select-none">
              <th className="w-[35%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-4 uppercase">Description</th>
              <th className="w-[25%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-2 uppercase">Category</th>
              <th className="w-[25%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-2 text-right uppercase">Amount</th>
              <th className="w-[15%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-2 text-center uppercase">Action</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100 bg-white">
            {displayExpenses && displayExpenses.length > 0 ? (
              displayExpenses.map((item) => {
                let displayCategory = item.category || "Other";
                if (displayCategory.toLowerCase().trim() === "food") {
                  displayCategory = "Food & Drinks";
                }

                const colors = getCategoryStyles(displayCategory) || { 
                  bg: "bg-slate-100", 
                  text: "text-slate-700" 
                };

                return (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex flex-col min-w-0 max-w-full">
                        <span 
                          className="text-xs font-bold text-slate-800 truncate block" 
                          title={item.description}
                        >
                          {item.description || "Untitled Transaction"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {item.date ? new Date(item.date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}) : "Recent"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-2 align-middle">
                      <div className="max-w-full truncate">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 border rounded-full tracking-wide truncate max-w-full ${colors.bg} ${colors.text}`}>
                          {displayCategory}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-2 text-right align-middle whitespace-nowrap">
                      <span
                        className="text-xs font-black text-slate-900 tracking-tight truncate block max-w-full"
                        title={item.amount ? Number(item.amount).toLocaleString("en-IN") : ""}
                      >
                        {formatAdvancedAmount ? formatAdvancedAmount(item.amount) : `₹${item.amount}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(item._id)}
                        disabled={deletingId === item._id}
                        aria-label="Delete expense"
                        className="min-h-[36px] min-w-[36px] px-2 py-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 text-red-600 rounded-lg cursor-pointer transition-colors font-bold text-[10px] touch-manipulation"
                      >
                        {deletingId === item._id ? "..." : "🗑️"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="py-12 text-center text-xs font-medium text-slate-400 bg-white">
                  No records indexed in this session.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-[10px] text-slate-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}