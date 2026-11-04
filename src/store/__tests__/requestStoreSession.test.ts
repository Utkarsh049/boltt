import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const { mockStorage } = vi.hoisted(() => {
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

  const storage = new MockStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: storage,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    writable: true,
    configurable: true,
  });

  return { mockStorage: storage };
});

import { SESSION_STORAGE_KEY } from "../../utils/session";

// Mock Tauri modules
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

let mockWindowLabel = "main";
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: mockWindowLabel,
  }),
}));

import {
  useRequestStore,
  flushSessionSave,
  scheduleSessionSave,
  isMainWindow,
} from "../requestStore";

describe("useRequestStore session persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWindowLabel = "main";
    mockStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks main window correctly", () => {
    mockWindowLabel = "main";
    expect(isMainWindow()).toBe(true);

    mockWindowLabel = "env-production";
    expect(isMainWindow()).toBe(false);
  });

  it("saves session when flushSessionSave is called", () => {
    mockWindowLabel = "main";
    const store = useRequestStore.getState();
    store.setUrl("https://api.example.com/v1/users");

    flushSessionSave();

    const raw = mockStorage.getItem(SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.tabs[0].request.url).toBe("https://api.example.com/v1/users");
  });

  it("debounces session save when scheduleSessionSave is called", () => {
    mockWindowLabel = "main";
    mockStorage.removeItem(SESSION_STORAGE_KEY);

    useRequestStore.getState().setUrl("https://example.com/debounced");
    scheduleSessionSave();

    // Not yet saved before timer completes
    expect(mockStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    // Advance 250ms
    vi.advanceTimersByTime(250);

    const raw = mockStorage.getItem(SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.tabs[0].request.url).toBe("https://example.com/debounced");
  });

  it("does not save session when in secondary window", () => {
    mockWindowLabel = "env-production";
    mockStorage.clear();

    useRequestStore.getState().setUrl("https://secondary-window.com");
    flushSessionSave();

    expect(mockStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("restores session from valid persisted storage", () => {
    mockWindowLabel = "main";
    const savedPayload = {
      version: 1,
      savedAt: Date.now(),
      activeTabId: "tab-restore-1",
      tabs: [
        {
          id: "tab-restore-1",
          request: {
            id: "req-1",
            name: "Restored Request",
            method: "POST" as const,
            url: "https://api.boltt.dev/restored",
            headers: [],
            params: [],
            body: { type: "Json" as const, content: '{"hello":"world"}' },
            auth: { type: "None" as const },
            ssl_verify: true,
          },
          isDirty: true,
        },
      ],
      activeRequest: {
        id: "req-1",
        name: "Restored Request",
        method: "POST" as const,
        url: "https://api.boltt.dev/restored",
        headers: [],
        params: [],
        body: { type: "Json" as const, content: '{"hello":"world"}' },
        auth: { type: "None" as const },
        ssl_verify: true,
      },
    };

    mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(savedPayload));

    const restored = useRequestStore.getState().restoreSession();
    expect(restored).toBe(true);

    const state = useRequestStore.getState();
    expect(state.activeTabId).toBe("tab-restore-1");
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0].request.name).toBe("Restored Request");
    expect(state.activeRequest.url).toBe("https://api.boltt.dev/restored");
    expect(state.response).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("clears saved session when clearSavedSession is invoked", () => {
    mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1 }));
    expect(mockStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();

    useRequestStore.getState().clearSavedSession();
    expect(mockStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
