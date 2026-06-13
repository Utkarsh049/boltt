import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type RequestBody =
  | { type: "Json"; content: string }
  | { type: "Raw"; content: string }
  | { type: "FormData"; content: KeyValue[] }
  | { type: "None"; content?: never };

export type AuthConfig =
  | { type: "None"; config?: never }
  | { type: "Bearer"; config: { token: string } }
  | { type: "Basic"; config: { username: string; password: string } };

export interface BoltRequest {
  id?: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  ssl_verify?: boolean;
}

export interface BoltResponse {
  status: number;
  status_text: string;
  headers: KeyValue[];
  body: string;
  time_ms: number;
  size_bytes: number;
}

interface RequestStore {
  activeRequest: BoltRequest;
  response: BoltResponse | null;
  isLoading: boolean;
  error: string | null;

  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setHeaders: (headers: KeyValue[]) => void;
  setParams: (params: KeyValue[]) => void;
  setBody: (body: RequestBody) => void;
  setAuth: (auth: AuthConfig) => void;
  setSslVerify: (sslVerify: boolean) => void;
  sendRequest: (env?: Record<string, string>) => Promise<void>;
  clearResponse: () => void;
  loadRequest: (request: BoltRequest) => void;
}

const initialRequest: BoltRequest = {
  name: "New Request",
  method: "GET",
  url: "https://httpbin.org/get",
  headers: [
    { key: "User-Agent", value: "BolttClient/0.1.0", enabled: true }
  ],
  params: [],
  body: { type: "None" },
  auth: { type: "None" },
  ssl_verify: true,
};

export const useRequestStore = create<RequestStore>((set, get) => ({
  activeRequest: initialRequest,
  response: null,
  isLoading: false,
  error: null,

  setMethod: (method) =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        method,
        // Adapt default body type on method change
        body: ["POST", "PUT", "PATCH"].includes(method) && state.activeRequest.body.type === "None"
          ? { type: "Json", content: "{}" }
          : !["POST", "PUT", "PATCH"].includes(method)
          ? { type: "None" }
          : state.activeRequest.body,
      },
    })),

  setUrl: (url) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, url },
    })),

  setHeaders: (headers) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, headers },
    })),

  setParams: (params) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, params },
    })),

  setBody: (body) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, body },
    })),

  setAuth: (auth) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, auth },
    })),

  setSslVerify: (sslVerify) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, ssl_verify: sslVerify },
    })),

  sendRequest: async (env = {}) => {
    set({ isLoading: true, error: null, response: null });
    const { activeRequest } = get();

    try {
      const res = await invoke<BoltResponse>("send_request", {
        request: activeRequest,
        env,
      });
      set({ response: res, isLoading: false });
    } catch (err) {
      console.error("send_request failed:", err);
      // Generate standard synthetic error response
      const errResponse: BoltResponse = {
        status: 0,
        status_text: "Network Error",
        headers: [],
        body: String(err),
        time_ms: 0,
        size_bytes: 0,
      };
      set({ response: errResponse, error: String(err), isLoading: false });
    }
  },

  clearResponse: () => set({ response: null, error: null }),
  loadRequest: (request) => set({ activeRequest: request, response: null }),
}));
