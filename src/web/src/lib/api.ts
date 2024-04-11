import axios, { AxiosInstance } from "axios";

export const getAPI = (token?: string): AxiosInstance => {
  const api = axios.create({
    headers: {
      "Content-Type": "application/json",
    },
    baseURL: "http://localhost:8000/",
  });
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
  return api;
};