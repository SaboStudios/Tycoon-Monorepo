import { ApiResponse } from "@/types/api";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export class ApiError extends Error {
  /** Axios response so getContractErrorMessage can read response.data.message */
  response?: { status?: number; data?: { message?: string; error?: string } };
  constructor(public status: number, message: string, public data?: any, response?: { status?: number; data?: any }) {
    super(message);
    this.name = "ApiError";
    this.response = response ?? (data && { status, data });
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://base-monopoly-production.up.railway.app/api";

class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const message = data?.message || data?.error || "API request failed";
          const apiError = new ApiError(status, message, data, error.response);
          return Promise.reject(apiError);
        } else if (error.request) {
          return Promise.reject(new ApiError(0, "No response from server"));
        } else {
          return Promise.reject(new ApiError(0, error.message));
        }
      }
    );
  }

  private async request<T>(
    config: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse = await this.axiosInstance.request(config);
    const data = response.data;

    return {
      success: true,
      message: data?.message || "Request successful",
      data: data,
    };
  }

  async get<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "GET", url: endpoint, params });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "POST", url: endpoint, data });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "PUT", url: endpoint, data });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "PATCH", url: endpoint, data });
  }

  async delete<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "DELETE", url: endpoint, params });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
