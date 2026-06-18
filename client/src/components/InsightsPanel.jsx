export default function InsightsPanel({ insights = [], loading = false, onRefresh }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 w-full">
      <div className="flex justify-between items-center gap-3 mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 m-0 tracking-tight">Smart Insights</h3>
          <p className="text-[11px] font-medium text-slate-400 m-0 mt-0.5">
            Data-driven recommendations from your real spending
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Refresh"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 m-0">Generating insights from your transaction data...</p>
      ) : insights.length === 0 ? (
        <p className="text-xs text-slate-400 m-0">Scan documents or add expenses to unlock insights.</p>
      ) : (
        <ul className="space-y-2.5 m-0 p-0 list-none">
          {insights.map((item, idx) => (
            <li
              key={`insight-${idx}`}
              className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 leading-relaxed"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
