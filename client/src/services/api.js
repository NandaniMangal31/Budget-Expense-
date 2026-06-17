import axios from "axios";

/**
 * Dynamically determines backend endpoint root URL
 * Supports local environment configurations seamlessly
 */
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  // In local development, always use local backend to avoid CORS/deploy drift.
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:5000/api";
  }

  if (envUrl?.trim() && envUrl !== "production") {
    return envUrl;
  }

  // Production fallback endpoint
  return "https://smart-spending-backend.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
});

// Let the browser set multipart boundary when uploading files (FormData).
API.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
  }
  return config;
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