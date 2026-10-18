import axios from "axios";

// In Vite, env vars must be prefixed with VITE_ and are read from .env files
// or the shell environment. See client/.env.example.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  // A hung request must never leave the UI waiting forever. Individual calls (the image upload)
  // override this with their own, longer limit.
  timeout: 30_000,
});
// Deliberately no default 'Content-Type' header here: axios correctly
// infers application/json for plain object payloads (register/login) on
// its own, and forcing it globally previously broke FormData image
// uploads (verificationService.js) by making axios JSON.stringify the
// FormData instead of sending it as multipart/form-data.

// Attach the JWT (if we have one) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mediTrust_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralize "session expired" handling: any 401 clears the stored session.
// AuthContext listens for this via the 'mediTrust:unauthorized' event.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mediTrust_token");
      localStorage.removeItem("mediTrust_user");
      window.dispatchEvent(new Event("mediTrust:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export default api;
