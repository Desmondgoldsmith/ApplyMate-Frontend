import axios from 'axios';

/**
 * Axios instance for calling the ApplyMate backend from the extension.
 * Keep token handling in `lib/storage.ts` and attach it in request interceptors.
 */
export const extensionApi = axios.create({
  baseURL: 'https://api.example.com',
  withCredentials: false,
});

extensionApi.interceptors.request.use(async (config) => {
  /** Attach bearer token from `chrome.storage` when implemented. */
  return config;
});
