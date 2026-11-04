import { Tab, BoltRequest } from "../store/requestStore";

export const SESSION_STORAGE_KEY = "boltt_session_v1";

export interface PersistedTab {
  id: string;
  request: BoltRequest;
  isDirty: boolean;
  bodyCache?: {
    Json: string;
    Raw: string;
    FormData: any[];
  };
}

export interface PersistedSession {
  version: 1;
  tabs: PersistedTab[];
  activeTabId: string | null;
  savedAt: number;
}

export interface RestoredSession {
  tabs: Tab[];
  activeTabId: string;
  activeRequest: BoltRequest;
}

/**
 * Serializes open tabs and active tab pointer to local session storage.
 * Transient properties like response payloads, loading state, and network errors are omitted.
 */
export const saveSession = (tabs: Tab[], activeTabId: string | null): boolean => {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    if (!tabs || tabs.length === 0) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return true;
    }

    const persistedTabs: PersistedTab[] = tabs.map((t) => ({
      id: t.id,
      request: t.request,
      isDirty: !!t.isDirty,
      bodyCache: t.bodyCache,
    }));

    const session: PersistedSession = {
      version: 1,
      tabs: persistedTabs,
      activeTabId,
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch (err) {
    console.warn("Failed to persist Boltt session to storage:", err);
    return false;
  }
};

/**
 * Loads and validates persisted session state from local storage.
 * Returns null if no session exists or if the stored data is invalid.
 */
export const loadSession = (): RestoredSession | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const data: PersistedSession = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.tabs) || data.tabs.length === 0) {
      return null;
    }

    // Reconstruct full Tab instances with runtime fields reset
    const reconstructedTabs: Tab[] = data.tabs
      .filter((pt) => pt && pt.id && pt.request && pt.request.url !== undefined)
      .map((pt) => {
        const reqBody = pt.request.body || { type: "None" };
        const safeRequest: BoltRequest = {
          ...pt.request,
          body: reqBody,
          headers: Array.isArray(pt.request.headers) ? pt.request.headers : [],
          params: Array.isArray(pt.request.params) ? pt.request.params : [],
          auth: pt.request.auth || { type: "None" },
          ssl_verify: pt.request.ssl_verify ?? true,
          extractors: Array.isArray(pt.request.extractors) ? pt.request.extractors : [],
        };

        return {
          id: pt.id,
          request: safeRequest,
          response: null,
          isLoading: false,
          error: null,
          isDirty: !!pt.isDirty,
          bodyCache: pt.bodyCache || {
            Json: reqBody.type === "Json" ? reqBody.content : "{}",
            Raw: reqBody.type === "Raw" ? reqBody.content : "",
            FormData: reqBody.type === "FormData" ? reqBody.content : [],
          },
        };
      });

    if (reconstructedTabs.length === 0) {
      return null;
    }

    // Ensure activeTabId points to a valid tab, otherwise fallback to the first
    const resolvedActiveTab =
      reconstructedTabs.find((t) => t.id === data.activeTabId) || reconstructedTabs[0];

    return {
      tabs: reconstructedTabs,
      activeTabId: resolvedActiveTab.id,
      activeRequest: resolvedActiveTab.request,
    };
  } catch (err) {
    console.warn("Failed to parse Boltt persisted session, falling back to default:", err);
    return null;
  }
};

/**
 * Clears the persisted session from storage.
 */
export const clearSession = (): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear Boltt session:", err);
    }
  }
};
