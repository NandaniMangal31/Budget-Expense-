import axios from "axios";

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  // ✅ Use environment variable if defined and not "production"
  if (envUrl && envUrl.trim() !== "" && envUrl !== "production") {
    return envUrl;
  }

  // ✅ Fallback to deployed backend
  return "https://smart-spending-backend.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Request interceptor: attach token if available
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response interceptor: auto-logout on 401 errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid session
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Redirect to login
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;
