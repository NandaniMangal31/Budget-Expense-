export default function ExpenseLogsTable({ displayExpenses, getCategoryStyles, formatAdvancedAmount, onDeleteExpense, deletingId }) {
  return (
    <div className="bg-white rounded-xl border shadow-xs h-[430px] overflow-hidden">
      <div className="p-5 border-b">
        <h3 className="text-sm font-bold">Recent Expenses Logs</h3>
        <span>{displayExpenses?.length || 0} Logs</span>
      </div>
      <div className="overflow-y-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {displayExpenses?.length > 0 ? (
              displayExpenses.map((item) => {
                let displayCategory = item.category || "Other";
                if (displayCategory.toLowerCase().trim() === "food") displayCategory = "Food & Drinks";
                const colors = getCategoryStyles(displayCategory);
                return (
                  <tr key={item._id}>
                    <td>{item.description}</td>
                    <td><span className={`${colors.bg} ${colors.text}`}>{displayCategory}</span></td>
                    <td>
                      {formatAdvancedAmount(item.amount)}
                      <button onClick={() => onDeleteExpense(item._id)} disabled={deletingId === item._id}>🗑️</button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="3">No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
