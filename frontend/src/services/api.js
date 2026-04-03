import axios from "axios";

const API_BASE = "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE
});

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
  create: (payload) => api.post("/claims", payload)
};

export const automationApi = {
  status: () => api.get("/automation/status")
};
