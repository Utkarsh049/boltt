import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useHistoryStore } from "./historyStore";

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

export interface Tab {
  id: string;
  request: BoltRequest;
  response: BoltResponse | null;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
  bodyCache?: {
    Json: string;
    Raw: string;
    FormData: KeyValue[];
  };
}

interface RequestStore {
  activeRequest: BoltRequest;
  response: BoltResponse | null;
  isLoading: boolean;
  error: string | null;
  tabs: Tab[];
  activeTabId: string | null;

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

  openTab: (request?: BoltRequest) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markTabClean: (id: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  updateRequestName: (requestId: string, newName: string) => void;
}

export const createInitialRequest = (): BoltRequest => ({
  id: crypto.randomUUID(),
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
});

const initialRequest = createInitialRequest();
const initialTabId = crypto.randomUUID();
const initialTab: Tab = {
  id: initialTabId,
  request: initialRequest,
  response: null,
  isLoading: false,
  error: null,
  isDirty: false,
  bodyCache: {
    Json: initialRequest.body.type === "Json" ? initialRequest.body.content : "{}",
    Raw: initialRequest.body.type === "Raw" ? initialRequest.body.content : "",
    FormData: initialRequest.body.type === "FormData" ? initialRequest.body.content : [],
  },
};

export const useRequestStore = create<RequestStore>((set, get) => ({
  activeRequest: initialRequest,
  response: null,
  isLoading: false,
  error: null,
  tabs: [initialTab],
  activeTabId: initialTabId,

  setMethod: (method) =>
    set((state) => {
      const newBody: RequestBody =
        ["POST", "PUT", "PATCH"].includes(method) && state.activeRequest.body.type === "None"
          ? { type: "Json", content: "{}" }
          : !["POST", "PUT", "PATCH"].includes(method)
          ? { type: "None" }
          : state.activeRequest.body;
      const updatedActiveRequest = {
        ...state.activeRequest,
        method,
        body: newBody,
      };
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, request: updatedActiveRequest, isDirty: true }
          : tab
      );
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  setUrl: (url) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, url };
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, request: updatedActiveRequest, isDirty: true }
          : tab
      );
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  setHeaders: (headers) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, headers };
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, request: updatedActiveRequest, isDirty: true }
          : tab
      );
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  setParams: (params) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, params };
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, request: updatedActiveRequest, isDirty: true }
          : tab
      );
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  setBody: (body) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, body };
      const updatedTabs = state.tabs.map((tab) => {
        if (tab.id === state.activeTabId) {
          const currentCache = tab.bodyCache || { Json: "{}", Raw: "", FormData: [] };
          const updatedCache = { ...currentCache };
          if (body.type === "Json") updatedCache.Json = body.content;
          if (body.type === "Raw") updatedCache.Raw = body.content;
          if (body.type === "FormData") updatedCache.FormData = body.content;

          return {
            ...tab,
            request: updatedActiveRequest,
            isDirty: true,
            bodyCache: updatedCache,
          };
        }
        return tab;
      });
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  setAuth: (auth) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, auth };
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, request: updatedActiveRequest, isDirty: true }
          : tab
      );
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  setSslVerify: (sslVerify) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, ssl_verify: sslVerify };
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, request: updatedActiveRequest, isDirty: true }
          : tab
      );
      return {
        activeRequest: updatedActiveRequest,
        tabs: updatedTabs,
      };
    }),

  sendRequest: async (env = {}) => {
    const { activeTabId, activeRequest } = get();
    if (!activeTabId) return;

    set((state) => ({
      isLoading: true,
      error: null,
      response: null,
      tabs: state.tabs.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, isLoading: true, error: null, response: null }
          : tab
      ),
    }));

    try {
      const res = await invoke<BoltResponse>("send_request", {
        request: activeRequest,
        env,
      });

      set((state) => {
        const updatedTabs = state.tabs.map((tab) =>
          tab.id === activeTabId ? { ...tab, response: res, isLoading: false } : tab
        );
        if (state.activeTabId === activeTabId) {
          return {
            response: res,
            isLoading: false,
            tabs: updatedTabs,
          };
        }
        return { tabs: updatedTabs };
      });

      // Refresh recent requests history
      useHistoryStore.getState().loadHistory();
    } catch (err) {
      console.error("send_request failed:", err);
      const errResponse: BoltResponse = {
        status: 0,
        status_text: "Network Error",
        headers: [],
        body: String(err),
        time_ms: 0,
        size_bytes: 0,
      };
      set((state) => {
        const updatedTabs = state.tabs.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, response: errResponse, error: String(err), isLoading: false }
            : tab
        );
        if (state.activeTabId === activeTabId) {
          return {
            response: errResponse,
            error: String(err),
            isLoading: false,
            tabs: updatedTabs,
          };
        }
        return { tabs: updatedTabs };
      });

      // Refresh recent requests history
      useHistoryStore.getState().loadHistory();
    }
  },

  clearResponse: () =>
    set((state) => {
      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, response: null, error: null } : tab
      );
      return {
        response: null,
        error: null,
        tabs: updatedTabs,
      };
    }),

  loadRequest: (request) => {
    const { tabs, activeTabId, setActiveTab } = get();

    // 1. Check if a tab with this request ID already exists
    const existingTab = tabs.find((t) => t.request.id === request.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    // 2. Check if the active tab is a clean default tab we can reuse
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const isCleanDefault =
      activeTab &&
      !activeTab.isDirty &&
      activeTab.request.name === "New Request" &&
      activeTab.request.url === "https://httpbin.org/get" &&
      activeTab.response === null;

    const initialCache = {
      Json: request.body.type === "Json" ? request.body.content : "{}",
      Raw: request.body.type === "Raw" ? request.body.content : "",
      FormData: request.body.type === "FormData" ? request.body.content : [],
    };

    if (isCleanDefault && activeTabId) {
      set((state) => {
        const updatedTabs = state.tabs.map((t) =>
          t.id === activeTabId ? { ...t, request, isDirty: false, bodyCache: initialCache } : t
        );
        return {
          tabs: updatedTabs,
          activeRequest: request,
          response: null,
          isLoading: false,
          error: null,
        };
      });
    } else {
      const newTabId = crypto.randomUUID();
      const newTab: Tab = {
        id: newTabId,
        request,
        response: null,
        isLoading: false,
        error: null,
        isDirty: false,
        bodyCache: initialCache,
      };
      set((state) => ({
        tabs: [...state.tabs, newTab],
        activeTabId: newTabId,
        activeRequest: request,
        response: null,
        isLoading: false,
        error: null,
      }));
    }
  },

  openTab: (request) => {
    const req = request || createInitialRequest();
    const { tabs, setActiveTab } = get();

    if (request && request.id) {
      const existingTab = tabs.find((t) => t.request.id === request.id);
      if (existingTab) {
        setActiveTab(existingTab.id);
        return;
      }
    }

    const newTabId = crypto.randomUUID();
    const initialCache = {
      Json: req.body.type === "Json" ? req.body.content : "{}",
      Raw: req.body.type === "Raw" ? req.body.content : "",
      FormData: req.body.type === "FormData" ? req.body.content : [],
    };
    const newTab: Tab = {
      id: newTabId,
      request: req,
      response: null,
      isLoading: false,
      error: null,
      isDirty: false,
      bodyCache: initialCache,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTabId,
      activeRequest: req,
      response: null,
      isLoading: false,
      error: null,
    }));
  },

  closeTab: (id) => {
    const { tabs, activeTabId, setActiveTab } = get();
    const tabToClose = tabs.find((t) => t.id === id);
    if (!tabToClose) return;

    if (tabToClose.isDirty) {
      const confirmClose = window.confirm(
        `"${tabToClose.request.name || "Request"}" has unsaved changes. Close anyway?`
      );
      if (!confirmClose) return;
    }

    const newTabs = tabs.filter((t) => t.id !== id);

    let newActiveTabId = activeTabId;
    if (activeTabId === id) {
      if (newTabs.length > 0) {
        const closedIdx = tabs.findIndex((t) => t.id === id);
        const nextActiveIdx = Math.min(closedIdx, newTabs.length - 1);
        newActiveTabId = newTabs[nextActiveIdx].id;
      } else {
        newActiveTabId = null;
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveTabId });
    if (newActiveTabId) {
      setActiveTab(newActiveTabId);
    } else {
      // Clear active request/response states when no tabs are open
      set({
        activeRequest: {
          name: "",
          method: "GET",
          url: "",
          headers: [],
          params: [],
          body: { type: "None" },
          auth: { type: "None" },
          ssl_verify: true,
        },
        response: null,
        isLoading: false,
        error: null,
      });
    }
  },

  setActiveTab: (id) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;

    // Ensure cache is initialized
    if (!tab.bodyCache) {
      tab.bodyCache = {
        Json: tab.request.body.type === "Json" ? tab.request.body.content : "{}",
        Raw: tab.request.body.type === "Raw" ? tab.request.body.content : "",
        FormData: tab.request.body.type === "FormData" ? tab.request.body.content : [],
      };
    }

    set({
      activeTabId: id,
      activeRequest: tab.request,
      response: tab.response,
      isLoading: tab.isLoading,
      error: tab.error,
    });
  },

  markTabClean: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.request.id === id || t.id === id ? { ...t, isDirty: false } : t
      ),
    }));
  },

  reorderTabs: (startIndex, endIndex) =>
    set((state) => {
      const updatedTabs = [...state.tabs];
      const [removed] = updatedTabs.splice(startIndex, 1);
      updatedTabs.splice(endIndex, 0, removed);
      return { tabs: updatedTabs };
    }),

  updateRequestName: (requestId, newName) =>
    set((state) => {
      const updatedTabs = state.tabs.map((tab) =>
        tab.request.id === requestId
          ? { ...tab, request: { ...tab.request, name: newName } }
          : tab
      );

      const updatedActiveRequest =
        state.activeRequest.id === requestId
          ? { ...state.activeRequest, name: newName }
          : state.activeRequest;

      return {
        tabs: updatedTabs,
        activeRequest: updatedActiveRequest,
      };
    }),
}));
