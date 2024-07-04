import axios, { AxiosInstance } from "axios";

export const getAPI = (token?: string): AxiosInstance => {
  const baseURL = "https://www.gaybaby.ca/api";
  const api = axios.create({
    headers: {
      "Content-Type": "application/json",
    },
    baseURL: baseURL,
  });
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
  return api;
};