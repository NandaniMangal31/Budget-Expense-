import axios from "axios";
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (envUrl && envUrl.trim() !== "" && envUrl !== "production") {
    return envUrl;
  }
    return "https://smart-spending-backend.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default API;