import axios from "axios";

// Determine API URL based on environment
const getApiUrl = () => {
  // Explicit override always wins.
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In local development, use Vite proxy to avoid browser CORS preflight blocks.
  if (import.meta.env.DEV) {
    return "/api";
  }

  // Hosted fallback
  if (import.meta.env.VITE_VERCEL_ENV) {
    return "https://niemis-backend.onrender.com/api";
  }

  // Default same-origin fallback for production-like environments.
  return "/api";
};

const API_URL = getApiUrl();

// Log API URL in development for debugging
if (import.meta.env.VITE_DEBUG_MODE === "true") {
  console.log("API URL:", API_URL);
  console.log("Environment:", import.meta.env.VITE_VERCEL_ENV || "development");
}

class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout for production
      withCredentials: false, // Disable credentials for CORS
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Add response interceptor to handle token expiration
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Log errors in development
        if (import.meta.env.VITE_DEBUG_MODE === "true") {
          console.error("API Error:", error.response?.data || error.message);
        }

        if (error.response?.status === 401) {
          console.error("401 Unauthorized error:", error.response?.data);
          console.error("Request URL:", error.config?.url);
          console.error("Request headers:", error.config?.headers);
          localStorage.removeItem("token");
          // Temporarily comment out automatic redirect for debugging
          // window.location.href = "/login";
        }

        // Handle network errors and timeouts
        if (error.code === "ECONNABORTED") {
          console.error("Request timeout");
        }

        return Promise.reject(error);
      },
    );
  }

  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common["Authorization"];
    }
  }

  async login(credentials) {
    const response = await this.api.post("/auth/login", credentials);
    return response;
  }

  async register(userData) {
    const response = await this.api.post("/auth/register", userData);
    return response;
  }

  async getProfile() {
    const response = await this.api.get("/auth/profile");
    return response;
  }

  async changePassword(passwordData) {
    const response = await this.api.put("/auth/change-password", passwordData);
    return response;
  }

  logout() {
    localStorage.removeItem("token");
    this.setAuthToken(null);
  }

  getToken() {
    return localStorage.getItem("token");
  }
}

export const authService = new AuthService();
