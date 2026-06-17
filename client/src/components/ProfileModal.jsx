import { useState, useEffect } from "react";
import API from "../services/api";

export default function ProfileModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "" 
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setFormData({
          name: parsed.name || "",
          email: parsed.email || "",
          password: ""
        });
      } catch (err) {
        console.error("Error parsing user context:", err);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const storedUser = localStorage.getItem("user");
      const userId = storedUser ? JSON.parse(storedUser)?._id : null;
      
      if (!userId) {
        alert("User session expired. Please sign in again.");
        return;
      }

      const res = await API.post(`/auth/update/${userId}`, {
        name: formData.name,
        email: formData.email,
        ...(formData.password && { password: formData.password })
      });

      if (res.data && res.data.success) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        alert(res.data.message || "Account details successfully synchronized! 🎉");
        window.location.reload(); 
        onClose();
      } else {
        alert(res.data?.message || "Failed to sync updates.");
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update profiles.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100]">
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-lg max-w-md w-full mx-4 box-border">
        <div className="border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900 m-0">👤 Identity Workspace</h3>
          <p className="text-xs text-slate-400 m-0 mt-0.5">Edit or update your account credential configurations</p>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Display Name</label>
            <input 
              type="text" 
              required
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" 
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Email Address</label>
            <input 
              type="email" 
              required
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})} 
              className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" 
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Update Password <span className="text-[10px] text-slate-400 font-normal">(Leave blank to keep current)</span></label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={formData.password} 
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
              className="px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-blue-500" 
            />
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-xs bg-slate-100 border rounded-md font-semibold cursor-pointer text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 text-xs bg-blue-600 text-white border rounded-md font-semibold cursor-pointer hover:bg-blue-700 disabled:bg-slate-300"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}