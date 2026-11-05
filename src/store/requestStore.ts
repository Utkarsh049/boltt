import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useHistoryStore } from "./historyStore";
import { useEnvStore } from "./envStore";
import { useToastStore } from "./toastStore";
import packageInfo from "../../package.json";
import { loadSession, saveSession, clearSession } from "../utils/session";
import { parseCurlCommand } from "../utils/curl";
import { runResponseExtractors } from "../utils/responseExtractor";
import { resolveRequestInheritance } from "../utils/inheritance";

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
  | { type: "Inherit"; config?: never }
  | { type: "Bearer"; config: { token: string } }
  | { type: "Basic"; config: { username: string; password: string } };

export type ExtractorSource = "body" | "header" | "status";

export interface ResponseExtractor {
  id: string;
  source: ExtractorSource;
  property: string;
  targetVariable: string;
  enabled: boolean;
}

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
  extractors?: ResponseExtractor[];
}

export interface TimingWaterfall {
  dns_ms: number;
  connect_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  transfer_ms: number;
  total_ms: number;
}

export interface BoltResponse {
  status: number;
  status_text: string;
  headers: KeyValue[];
  body: string;
  time_ms: number;
  size_bytes: number;
  timing?: TimingWaterfall;
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
  theme: string;

  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setHeaders: (headers: KeyValue[]) => void;
  setParams: (params: KeyValue[]) => void;
  setBody: (body: RequestBody) => void;
  setAuth: (auth: AuthConfig) => void;
  setSslVerify: (sslVerify: boolean) => void;
  setExtractors: (extractors: ResponseExtractor[]) => void;
  sendRequest: (env?: Record<string, string>) => Promise<void>;
  clearResponse: () => void;
  loadRequest: (request: BoltRequest) => void;

  openTab: (request?: BoltRequest) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markTabClean: (id: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  updateRequestName: (requestId: string, newName: string) => void;
  setTheme: (theme: string, options?: { persist?: boolean }) => void;
  restoreSession: () => boolean;
  clearSavedSession: () => void;
  importCurl: (curlStr: string, options?: { inPlace?: boolean }) => boolean;
}

export const createInitialRequest = (): BoltRequest => ({
  id: crypto.randomUUID(),
  name: "New Request",
  method: "GET",
  url: "https://httpbin.org/get",
  headers: [
    { key: "User-Agent", value: `BolttClient/${packageInfo.version}`, enabled: true }
  ],
  params: [],
  body: { type: "None" },
  auth: { type: "None" },
  ssl_verify: true,
  extractors: [],
});

export const isMainWindow = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return getCurrentWindow().label === "main";
  } catch {
    return true;
  }
};

const restoredSession = typeof window !== "undefined" && isMainWindow() ? loadSession() : null;

const defaultRequest = createInitialRequest();
const defaultTabId = crypto.randomUUID();
const defaultTab: Tab = {
  id: defaultTabId,
  request: defaultRequest,
  response: null,
  isLoading: false,
  error: null,
  isDirty: false,
  bodyCache: {
    Json: defaultRequest.body.type === "Json" ? defaultRequest.body.content : "{}",
    Raw: defaultRequest.body.type === "Raw" ? defaultRequest.body.content : "",
    FormData: defaultRequest.body.type === "FormData" ? defaultRequest.body.content : [],
  },
};

const initialRequest = restoredSession?.activeRequest || defaultRequest;
const initialTabs: Tab[] =
  restoredSession?.tabs && restoredSession.tabs.length > 0 ? restoredSession.tabs : [defaultTab];
const initialTabId = restoredSession?.activeTabId || defaultTabId;

export const useRequestStore = create<RequestStore>((set, get) => ({
  activeRequest: initialRequest,
  response: null,
  isLoading: false,
  error: null,
  tabs: initialTabs,
  activeTabId: initialTabId,
  theme: (typeof localStorage !== "undefined" ? localStorage.getItem("boltt-theme") : null) || "dark",

  setTheme: (theme, options = { persist: true }) => {
    const validThemes = ["dark", "light", "nord", "dracula", "space", "glass"];
    if (!validThemes.includes(theme)) return;

    if (options.persist && typeof localStorage !== "undefined") {
      localStorage.setItem("boltt-theme", theme);
    }
    // Sync class list
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.className = "";
      if (theme !== "dark") {
        root.classList.add(`theme-${theme}`);
      }
    }
    set({ theme });
    
    // Broadcast theme changes to other windows (multi-window sync)
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("theme-changed", theme).catch((err) => {
          console.warn("Failed to broadcast theme change:", err);
        });
      }).catch((err) => {
        console.debug("Tauri event API not resolved:", err);
      });
    }
  },

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

  setExtractors: (extractors) =>
    set((state) => {
      const updatedActiveRequest = { ...state.activeRequest, extractors };
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

    // Auto-prefix http:// if missing scheme and not a variable template
    let requestToSend = activeRequest;
    const trimmedUrl = activeRequest.url.trim();
    if (trimmedUrl && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl) && !trimmedUrl.startsWith("{{")) {
      const normalizedUrl = `http://${trimmedUrl}`;
      get().setUrl(normalizedUrl);
      requestToSend = { ...activeRequest, url: normalizedUrl };
    }

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

    // Resolve inherited auth and cascading headers from folder hierarchy
    let finalRequestToSend = requestToSend;
    try {
      const { useProjectsStore } = await import("./projectsStore");
      const projects = useProjectsStore.getState().projects;
      const activeTab = get().tabs.find((t) => t.id === activeTabId);
      const requestId = activeRequest.id || activeTab?.id || null;
      const { effectiveAuth, effectiveHeaders } = resolveRequestInheritance(
        projects,
        requestId,
        requestToSend
      );

      finalRequestToSend = {
        ...requestToSend,
        auth: effectiveAuth,
        headers: effectiveHeaders,
      };
    } catch (e) {
      console.warn("Could not resolve inheritance, sending request as-is:", e);
    }

    try {
      const res = await invoke<BoltResponse>("send_request", {
        request: finalRequestToSend,
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

      // Execute response extractors on 2xx responses
      if (
        res.status >= 200 &&
        res.status < 300 &&
        requestToSend.extractors &&
        requestToSend.extractors.length > 0
      ) {
        const extractedItems = runResponseExtractors(res, requestToSend.extractors);
        if (extractedItems.length > 0) {
          for (const item of extractedItems) {
            await useEnvStore
              .getState()
              .setVariableInActiveEnvironment(item.targetVariable, item.value);
          }
          const summary = extractedItems.map((e) => `{{${e.targetVariable}}}`).join(", ");
          useToastStore.getState().showToast(`Captured ${summary} to active environment`, "success");
        }
      }
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
      set((state) => {
        const updatedTabs = state.tabs.map((t) =>
          t.request.id === request.id ? { ...t, request } : t
        );
        const isCurrentlyActive = state.activeTabId === existingTab.id;
        return {
          tabs: updatedTabs,
          activeRequest: isCurrentlyActive ? request : state.activeRequest,
        };
      });
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
    const req = request ? { ...request } : createInitialRequest();
    if (!req.id) {
      req.id = crypto.randomUUID();
    }
    const { tabs, setActiveTab } = get();

    const existingTab = tabs.find((t) => t.request.id === req.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
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

  restoreSession: () => {
    const session = loadSession();
    if (!session || session.tabs.length === 0) return false;
    set({
      tabs: session.tabs,
      activeTabId: session.activeTabId,
      activeRequest: session.activeRequest,
      response: null,
      isLoading: false,
      error: null,
    });
    return true;
  },

  clearSavedSession: () => {
    clearSession();
  },

  importCurl: (curlStr, options = { inPlace: false }) => {
    const parsed = parseCurlCommand(curlStr);
    if (!parsed) return false;

    const { tabs, activeTabId } = get();
    const activeTab = tabs.find((t) => t.id === activeTabId);

    const isCleanDefault =
      activeTab &&
      !activeTab.isDirty &&
      activeTab.request.name === "New Request" &&
      activeTab.request.url === "https://httpbin.org/get" &&
      activeTab.response === null;

    const shouldReplaceInPlace = options.inPlace || isCleanDefault;
    const targetTabId = shouldReplaceInPlace && activeTabId ? activeTabId : null;

    const newRequest: BoltRequest = {
      id: targetTabId && activeTab ? activeTab.request.id || crypto.randomUUID() : crypto.randomUUID(),
      name:
        activeTab && activeTab.request.name !== "New Request" && options.inPlace
          ? activeTab.request.name
          : parsed.name || "cURL Request",
      method: parsed.method,
      url: parsed.url,
      headers: parsed.headers,
      params: parsed.params,
      body: parsed.body,
      auth: parsed.auth,
      ssl_verify: parsed.ssl_verify,
    };

    const initialCache = {
      Json: newRequest.body.type === "Json" ? newRequest.body.content : "{}",
      Raw: newRequest.body.type === "Raw" ? newRequest.body.content : "",
      FormData: newRequest.body.type === "FormData" ? newRequest.body.content : [],
    };

    if (targetTabId) {
      set((state) => {
        const updatedTabs = state.tabs.map((tab) =>
          tab.id === targetTabId
            ? {
                ...tab,
                request: newRequest,
                isDirty: true,
                bodyCache: initialCache,
                response: null,
                isLoading: false,
                error: null,
              }
            : tab
        );
        return {
          tabs: updatedTabs,
          activeRequest: newRequest,
          response: null,
          isLoading: false,
          error: null,
        };
      });
      return true;
    } else {
      const newTabId = crypto.randomUUID();
      const newTab: Tab = {
        id: newTabId,
        request: newRequest,
        response: null,
        isLoading: false,
        error: null,
        isDirty: true,
        bodyCache: initialCache,
      };

      set((state) => ({
        tabs: [...state.tabs, newTab],
        activeTabId: newTabId,
        activeRequest: newRequest,
        response: null,
        isLoading: false,
        error: null,
      }));
      return true;
    }
  },
}));

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const flushSessionSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!isMainWindow()) return;
  const { tabs, activeTabId } = useRequestStore.getState();
  saveSession(tabs, activeTabId);
};

export const scheduleSessionSave = () => {
  if (!isMainWindow()) return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    flushSessionSave();
  }, 250);
};

if (typeof window !== "undefined") {
  useRequestStore.subscribe((state, prevState) => {
    if (
      state.tabs !== prevState.tabs ||
      state.activeTabId !== prevState.activeTabId ||
      state.activeRequest !== prevState.activeRequest
    ) {
      scheduleSessionSave();
    }
  });

  if (typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => {
      flushSessionSave();
    });
    window.addEventListener("pagehide", () => {
      flushSessionSave();
    });
  }
}
