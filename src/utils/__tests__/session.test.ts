import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveSession, loadSession, clearSession, SESSION_STORAGE_KEY } from "../session";
import { Tab } from "../../store/requestStore";

class MockStorage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear(): void {
    this.store = {};
  }
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const mockStorage = new MockStorage();
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: { localStorage: mockStorage },
  writable: true,
  configurable: true,
});

const createMockTab = (id: string, name: string, url: string, isDirty = false): Tab => ({
  id,
  request: {
    id,
    name,
    method: "POST",
    url,
    headers: [{ key: "Authorization", value: "Bearer token-123", enabled: true }],
    params: [{ key: "filter", value: "active", enabled: true }],
    body: { type: "Json", content: '{"draft": true}' },
    auth: { type: "None" },
    ssl_verify: true,
  },
  response: {
    status: 200,
    status_text: "OK",
    headers: [],
    body: "large response data that should not be saved",
    time_ms: 120,
    size_bytes: 4096,
  },
  isLoading: true,
  error: "old error",
  isDirty,
  bodyCache: {
    Json: '{"draft": true}',
    Raw: "",
    FormData: [],
  },
});

describe("session storage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns null when no session is stored in localStorage", () => {
    expect(loadSession()).toBeNull();
  });

  it("saves and restores multiple tabs with active tab ID", () => {
    const tab1 = createMockTab("tab-1", "Login API", "https://api.example.com/login", false);
    const tab2 = createMockTab("tab-2", "Draft User Edit", "https://api.example.com/users/42", true);

    const saved = saveSession([tab1, tab2], "tab-2");
    expect(saved).toBe(true);

    const restored = loadSession();
    expect(restored).not.toBeNull();
    expect(restored!.tabs.length).toBe(2);
    expect(restored!.activeTabId).toBe("tab-2");
    expect(restored!.activeRequest.name).toBe("Draft User Edit");
    expect(restored!.activeRequest.url).toBe("https://api.example.com/users/42");

    // Verify dirty flag is preserved
    expect(restored!.tabs[0].isDirty).toBe(false);
    expect(restored!.tabs[1].isDirty).toBe(true);
  });

  it("omits transient runtime fields (response, isLoading, error) upon restoration", () => {
    const tab = createMockTab("tab-1", "Test", "https://api.example.com/test");
    saveSession([tab], "tab-1");

    const restored = loadSession();
    expect(restored).not.toBeNull();
    const restoredTab = restored!.tabs[0];

    // Runtime state must be cleanly reset
    expect(restoredTab.response).toBeNull();
    expect(restoredTab.isLoading).toBe(false);
    expect(restoredTab.error).toBeNull();

    // Request payload must be preserved
    expect(restoredTab.request.headers.length).toBe(1);
    expect(restoredTab.request.body).toEqual({ type: "Json", content: '{"draft": true}' });
  });

  it("falls back to the first tab if activeTabId is invalid or missing", () => {
    const tab1 = createMockTab("tab-1", "Tab One", "https://api.example.com/1");
    const tab2 = createMockTab("tab-2", "Tab Two", "https://api.example.com/2");

    saveSession([tab1, tab2], "non-existent-id");

    const restored = loadSession();
    expect(restored).not.toBeNull();
    expect(restored!.activeTabId).toBe("tab-1");
    expect(restored!.activeRequest.name).toBe("Tab One");
  });

  it("handles corrupted or invalid JSON in storage safely without throwing", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "invalid-json-content{");
    expect(loadSession()).toBeNull();

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 99, tabs: [] }));
    expect(loadSession()).toBeNull();
  });

  it("safely fills default structures when tab data in session has missing fields", () => {
    const rawSession = {
      version: 1,
      savedAt: Date.now(),
      activeTabId: "tab-malformed",
      tabs: [
        {
          id: "tab-malformed",
          request: {
            id: "req-malformed",
            name: "Partial Request",
            method: "GET",
            url: "https://example.com/api",
            // missing body, headers, params, auth
          },
        },
      ],
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(rawSession));

    const restored = loadSession();
    expect(restored).not.toBeNull();
    expect(restored!.tabs[0].request.body).toEqual({ type: "None" });
    expect(restored!.tabs[0].request.headers).toEqual([]);
    expect(restored!.tabs[0].request.params).toEqual([]);
    expect(restored!.tabs[0].request.ssl_verify).toBe(true);
    expect(restored!.tabs[0].bodyCache).toEqual({ Json: "{}", Raw: "", FormData: [] });
  });

  it("clears persisted session cleanly", () => {
    const tab = createMockTab("tab-1", "Test", "https://api.example.com");
    saveSession([tab], "tab-1");
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();

    clearSession();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(loadSession()).toBeNull();
  });
});
