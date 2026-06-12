import axios from "axios";


const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL === "production"
    ? "https://smart-spending-backend.onrender.com/api"
    : "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});
API.interceptors.request.use(
  (config) => {
    // Local storage se dynamic authentication token string fetch karein
    const token = localStorage.getItem("token");
    
    if (token) {
      // Headers package authorization key set mapping string pattern
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
export default API;