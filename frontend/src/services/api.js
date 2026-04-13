import axios from "axios";

const envApiBase = import.meta.env.VITE_API_BASE_URL;
const isLocalHost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const API_BASE = envApiBase || (isLocalHost ? "http://localhost:5000/api" : "/api");

if (!envApiBase && !isLocalHost) {
  console.warn("VITE_API_BASE_URL is not set. Falling back to /api. Configure your deployed frontend env vars.");
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.code === "ECONNABORTED") {
      error.userMessage = "Request timed out. Please check if backend API is running and reachable.";
    } else if (!error?.response) {
      error.userMessage = "Unable to reach server. Verify VITE_API_BASE_URL and backend deployment status.";
    }

    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export const authApi = {
  register: (payload) => api.post("/auth/register", payload),
  login: (payload) => api.post("/auth/login", payload)
};

export const policyApi = {
  list: () => api.get("/policies"),
  purchase: (policyId) => api.post("/policies/purchase", { policyId }),
  active: () => api.get("/policies/active")
};

export const claimApi = {
  list: () => api.get("/claims"),
  create: (payload) => api.post("/claims", payload),
  metrics: () => api.get("/claims/metrics"),
  gateways: () => api.get("/claims/payout-gateways"),
  review: (claimId, payload) => api.patch(`/claims/${claimId}/review`, payload)
};

export const automationApi = {
  status: () => api.get("/automation/status")
};
