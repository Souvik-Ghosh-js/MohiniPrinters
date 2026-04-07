import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import store from '../store'
import { logout } from '../store/slices/authSlice'

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000'
const BASE = API_URL.replace(/\/$/, '')

const api = axios.create({
  baseURL: BASE,
})

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = store.getState().auth.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      store.dispatch(logout())
      // Optional: Clear any app state if needed
      // Redirect happens automatically because PrivateRoute reacts to the store change
    }
    return Promise.reject(error)
  }
)

export default api
