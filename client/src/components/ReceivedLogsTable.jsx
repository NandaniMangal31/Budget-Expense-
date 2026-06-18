export default function ReceivedLogsTable({
  displayReceived,
  totalCount = 0,
  page = 1,
  totalPages = 1,
  onPageChange,
  formatAdvancedAmount,
  onDeleteExpense,
  deletingId,
  onDeleteAll,
  isDeletingAll,
}) {
  return (
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs flex flex-col h-[320px] w-full overflow-hidden box-border">
      <div className="p-5 border-b border-emerald-100 bg-emerald-50/40 shrink-0">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-black text-emerald-900 m-0 tracking-tight">Received</h3>
            <p className="text-[11px] font-medium text-emerald-600/70 m-0 mt-0.5">
              Credited, refund & income entries
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {displayReceived?.length > 0 && onDeleteAll && (
              <button
                type="button"
                onClick={onDeleteAll}
                disabled={isDeletingAll}
                className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors disabled:opacity-50"
              >
                {isDeletingAll ? "Deleting..." : "Delete All"}
              </button>
            )}
            <span className="bg-emerald-100 text-emerald-700 font-bold text-[10px] px-2 py-1 rounded-md shrink-0">
              {totalCount || displayReceived?.length || 0} Logs
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto overflow-x-auto w-full bg-emerald-50/20">
        <table className="w-full border-collapse text-left table-fixed min-w-[300px]">
          <thead>
            <tr className="border-b border-emerald-100 bg-emerald-50/60 sticky top-0 z-10 select-none">
              <th className="w-[40%] text-[10px] font-black text-emerald-700/70 tracking-wider py-3 px-4 uppercase">
                Description
              </th>
              <th className="w-[35%] text-[10px] font-black text-emerald-700/70 tracking-wider py-3 px-2 text-right uppercase">
                Amount
              </th>
              <th className="w-[25%] text-[10px] font-black text-emerald-700/70 tracking-wider py-3 px-2 text-center uppercase">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-emerald-100 bg-white">
            {displayReceived && displayReceived.length > 0 ? (
              displayReceived.map((item) => (
                <tr key={item._id} className="hover:bg-emerald-50/50 transition-colors group">
                  <td className="py-3.5 px-4 align-middle">
                    <div className="flex flex-col min-w-0 max-w-full">
                      <span
                        className="text-xs font-bold text-slate-800 truncate block"
                        title={item.description}
                      >
                        {item.description || "Received Transaction"}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600/60 mt-0.5">
                        {item.date
                          ? new Date(item.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "Recent"}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-2 text-right align-middle whitespace-nowrap">
                    <span
                      className="text-xs font-black text-emerald-700 tracking-tight truncate block max-w-full"
                      title={item.amount ? Number(item.amount).toLocaleString("en-IN") : ""}
                    >
                      +{formatAdvancedAmount ? formatAdvancedAmount(item.amount) : `₹${item.amount}`}
                    </span>
                  </td>

                  <td className="py-3.5 px-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(item._id)}
                      disabled={deletingId === item._id}
                      aria-label="Delete received entry"
                      className="min-h-[36px] min-w-[36px] px-2 py-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 text-red-600 rounded-lg cursor-pointer transition-colors font-bold text-[10px] touch-manipulation"
                    >
                      {deletingId === item._id ? "..." : "🗑️"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="py-10 text-center text-xs font-medium text-emerald-600/50 bg-white">
                  No received or refund entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="p-3 border-t border-emerald-100 bg-white flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-[10px] text-emerald-600 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
