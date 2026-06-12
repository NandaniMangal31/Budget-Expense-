export default function BudgetModal({ isOpen, targetInputs, setTargetInputs, onSave, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
      <div className="sm:col-span-3 border-b border-slate-100 pb-2 mb-1">
        <h3 className="text-sm font-bold text-slate-900 m-0">Manual Threshold Calibration Gateway</h3>
        <p className="text-[11px] text-slate-400 m-0">Configure personalized limits</p>
      </div>
      
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">Total Base Target (Overall)</label>
        <input type="text" value={targetInputs.totalBudget} placeholder="e.g. 50000" onChange={(e)=>setTargetInputs({...targetInputs, totalBudget: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">🍔 Food & Drinks Cap</label>
        <input type="text" value={targetInputs["Food & Drinks"]} placeholder="e.g. 8000" onChange={(e)=>setTargetInputs({...targetInputs, "Food & Drinks": e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">🚌 Travel & Logistics Cap</label>
        <input type="text" value={targetInputs["Travel & Transport"]} placeholder="e.g. 4000" onChange={(e)=>setTargetInputs({...targetInputs, "Travel & Transport": e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">🛍️ Shopping Target</label>
        <input type="text" value={targetInputs.Shopping} placeholder="e.g. 15000" onChange={(e)=>setTargetInputs({...targetInputs, Shopping: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">🧾 Utility Bills Target</label>
        <input type="text" value={targetInputs["Bills & Utilities"]} placeholder="e.g. 6000" onChange={(e)=>setTargetInputs({...targetInputs, "Bills & Utilities": e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">🎬 Entertainment Limit</label>
        <input type="text" value={targetInputs.Entertainment} placeholder="e.g. 3000" onChange={(e)=>setTargetInputs({...targetInputs, Entertainment: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700">⚙️ Other Limit</label>
        <input type="text" value={targetInputs.Other} placeholder="e.g. 5000" onChange={(e)=>setTargetInputs({...targetInputs, Other: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" />
      </div>
      
      <div className="sm:col-span-3 flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs bg-slate-100 border rounded-md font-semibold cursor-pointer text-slate-600 hover:bg-slate-200">Cancel</button>
        <button type="button" onClick={onSave} className="px-5 py-2 text-xs bg-emerald-600 text-white border-none rounded-md font-bold cursor-pointer hover:bg-emerald-700">Lock Targets 💾</button>
      </div>
    </div>
  );
}