import axios from "axios";

/**
 * Dynamically determines backend endpoint root URL
 * Supports local environment configurations seamlessly
 */
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (envUrl?.trim() && envUrl !== "production") {
    return envUrl;
  }
  // Academic Render fallback endpoint
  return "https://smart-spending-backend.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional global response management (Highly recommended)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // 🚨 Centralized Auth Expiry Error Handling
    if (error.response?.status === 401) {
      console.warn("Session token expired or unvalidated. Purging client credentials...");
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch (e) {
        // Safe catch block for storage locks
      }
      // Optional: Force reload to push users back to login layout cleanly
      if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default API;