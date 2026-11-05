import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock Tauri modules
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "main",
  }),
}));

import { useRequestStore, createInitialRequest, BoltResponse } from "../requestStore";

describe("useRequestStore previousResponse tracking", () => {
  beforeEach(() => {
    mockInvoke.mockReset();

    const req1 = createInitialRequest();
    const tab1Id = "tab-1";

    useRequestStore.setState({
      tabs: [
        {
          id: tab1Id,
          request: req1,
          response: null,
          previousResponse: null,
          isLoading: false,
          error: null,
          isDirty: false,
        },
      ],
      activeTabId: tab1Id,
      activeRequest: req1,
      response: null,
      previousResponse: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes tab with previousResponse as null", () => {
    const state = useRequestStore.getState();
    expect(state.previousResponse).toBeNull();
    expect(state.tabs[0].previousResponse).toBeNull();
  });

  it("stores previous response when consecutive requests are dispatched", async () => {
    const res1: BoltResponse = {
      status: 200,
      status_text: "OK",
      headers: [{ key: "content-type", value: "application/json", enabled: true }],
      body: '{"version": 1}',
      time_ms: 50,
      size_bytes: 16,
    };

    const res2: BoltResponse = {
      status: 200,
      status_text: "OK",
      headers: [{ key: "content-type", value: "application/json", enabled: true }],
      body: '{"version": 2}',
      time_ms: 45,
      size_bytes: 16,
    };

    // First request dispatch
    mockInvoke.mockResolvedValueOnce(res1);
    await useRequestStore.getState().sendRequest();

    let state = useRequestStore.getState();
    expect(state.response?.body).toBe('{"version": 1}');
    expect(state.previousResponse).toBeNull();
    expect(state.tabs[0].response?.body).toBe('{"version": 1}');

    // Second request dispatch
    mockInvoke.mockResolvedValueOnce(res2);
    await useRequestStore.getState().sendRequest();

    state = useRequestStore.getState();
    expect(state.response?.body).toBe('{"version": 2}');
    expect(state.previousResponse?.body).toBe('{"version": 1}');
    expect(state.tabs[0].previousResponse?.body).toBe('{"version": 1}');
  });

  it("synchronizes previousResponse when switching tabs", () => {
    const resA: BoltResponse = {
      status: 200,
      status_text: "OK",
      headers: [],
      body: '{"tab": "A"}',
      time_ms: 10,
      size_bytes: 12,
    };
    const prevA: BoltResponse = {
      status: 200,
      status_text: "OK",
      headers: [],
      body: '{"tab": "A-prev"}',
      time_ms: 12,
      size_bytes: 17,
    };

    const resB: BoltResponse = {
      status: 404,
      status_text: "Not Found",
      headers: [],
      body: '{"error": "not found"}',
      time_ms: 20,
      size_bytes: 22,
    };

    const tabAId = "tab-a";
    const tabBId = "tab-b";
    const reqA = createInitialRequest();
    const reqB = { ...createInitialRequest(), name: "Tab B" };

    useRequestStore.setState({
      tabs: [
        {
          id: tabAId,
          request: reqA,
          response: resA,
          previousResponse: prevA,
          isLoading: false,
          error: null,
          isDirty: false,
        },
        {
          id: tabBId,
          request: reqB,
          response: resB,
          previousResponse: null,
          isLoading: false,
          error: null,
          isDirty: false,
        },
      ],
      activeTabId: tabAId,
      activeRequest: reqA,
      response: resA,
      previousResponse: prevA,
      isLoading: false,
      error: null,
    });

    // Currently on tab A
    expect(useRequestStore.getState().previousResponse?.body).toBe('{"tab": "A-prev"}');

    // Switch to tab B
    useRequestStore.getState().setActiveTab(tabBId);
    expect(useRequestStore.getState().activeTabId).toBe(tabBId);
    expect(useRequestStore.getState().response?.status).toBe(404);
    expect(useRequestStore.getState().previousResponse).toBeNull();

    // Switch back to tab A
    useRequestStore.getState().setActiveTab(tabAId);
    expect(useRequestStore.getState().previousResponse?.body).toBe('{"tab": "A-prev"}');
  });
});

