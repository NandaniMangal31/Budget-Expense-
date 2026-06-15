
export default function ExpenseLogsTable({ 
  displayExpenses, 
  getCategoryStyles, 
  formatAdvancedAmount, 
  onDeleteExpense, 
  deletingId 
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[430px] w-full overflow-hidden box-border">
      
      {/* HEADER SECTION */}
      <div className="p-5 border-b border-slate-100 bg-white shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-slate-900 m-0 tracking-tight">Recent Expenses Logs</h3>
            <p className="text-[11px] font-medium text-slate-400 m-0 mt-0.5">Real-time entries stream from database</p>
          </div>
          <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-1 rounded-md">
            {displayExpenses?.length || 0} Logs
          </span>
        </div>
      </div>

      {/* STABLE DATA TABLE STRUCTURE */}
      <div className="flex-grow overflow-y-auto overflow-x-auto w-full custom-scrollbar bg-slate-50/30">
        <table className="w-full border-collapse text-left table-fixed">
          {/* STRICT LAYOUT COLUMNS RATIO */}
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 sticky top-0 z-10 select-none">
              <th className="w-[45%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-4 uppercase">Description</th>
              <th className="w-[30%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-2 uppercase">Category</th>
              <th className="w-[25%] text-[10px] font-black text-slate-400 tracking-wider py-3 px-4 text-right uppercase">Amount</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100 bg-white">
            {displayExpenses && displayExpenses.length > 0 ? (
              displayExpenses.map((item) => {
                
                // 🎯 YOUR EXACT RE-INSTALLED CATEGORY NORMALIZATION LOGIC
                let displayCategory = item.category || "Other";
                if (displayCategory.toLowerCase().trim() === "food") {
                  displayCategory = "Food & Drinks";
                }

                // 🎯 MATCHING YOUR PREVIOUS EXACT COLOR EXTRACTOR ENGINE
                const colors = getCategoryStyles(displayCategory) || { 
                  bg: "bg-slate-100", 
                  text: "text-slate-700" 
                };

                return (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition-colors group">
                    
                    {/* DESCRIPTION CELL WITH SMART WRAPPING */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex flex-col min-w-0">
                        <span 
                          className="text-xs font-bold text-slate-800 truncate" 
                          title={item.description}
                        >
                          {item.description || "Untitled Transaction"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {item.date ? new Date(item.date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}) : "Recent"}
                        </span>
                      </div>
                    </td>

                    {/* 🎯 CATEGORY METADATA TAG (YOUR EXACT ROUNDED-FULL CAPSULE STYLE) */}
                    <td className="py-3.5 px-2 align-middle">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 border rounded-full tracking-wide truncate max-w-full ${colors.bg} ${colors.text}`}>
                        {displayCategory}
                      </span>
                    </td>

                    {/* AMOUNT & FLOATING DELETE ACTION BLOCK */}
                    <td className="py-3.5 px-4 text-right align-middle relative">
                      <div className="flex items-center justify-end gap-2 group-hover:translate-x-[-24px] transition-transform duration-200">
                        <span className="text-xs font-black text-slate-900 tracking-tight">
                          {formatAdvancedAmount ? formatAdvancedAmount(item.amount) : `₹${item.amount}`}
                        </span>
                      </div>

                      {/* HOVER SLIDE DELETE ENGINE */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                        <button
                          onClick={() => onDeleteExpense(item._id)}
                          disabled={deletingId === item._id}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg cursor-pointer transition-colors font-bold text-[10px]"
                          title="Delete permanently"
                        >
                          {deletingId === item._id ? "..." : "🗑️"}
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="3" className="py-12 text-center text-xs font-medium text-slate-400 bg-white">
                  No records indexed in this session.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}