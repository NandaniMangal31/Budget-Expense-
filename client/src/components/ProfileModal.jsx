import { useState, useEffect, useContext } from "react";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function ProfileModal({ isOpen, onClose }) {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setFormData({ name: parsed.name || "", email: parsed.email || "", password: "" });
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
        ...(formData.password && { password: formData.password }),
      });

      if (res.data?.success) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        // ✅ Update AuthContext instead of full reload
        login({ token: localStorage.getItem("token"), user: res.data.user });
        alert(res.data.message || "Account details updated successfully! 🎉");
        onClose();
      } else {
        alert(res.data?.message || "Failed to sync updates.");
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100]">
      <div className="bg-white border p-6 rounded-xl shadow-lg max-w-md w-full">
        <h3 className="text-base font-bold">👤 Identity Workspace</h3>
        <form onSubmit={handleUpdate} className="flex flex-col gap-4 mt-4">
          <div>
            <label>Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div>
            <label>Password (optional)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 rounded">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded">
              {loading ? "Saving..." : "Lock Changes 💾"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
