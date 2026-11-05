import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Tauri modules
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

import { useEnvStore, openEnvironmentWindow } from "../envStore";

describe("envStore reactivity and modal triggers", () => {
  beforeEach(() => {
    useEnvStore.setState({
      environments: [
        {
          id: "production:prod-1",
          name: "Prod Primary",
          variables: [{ key: "API_URL", value: "https://api.prod.com", enabled: true, is_secret: false }],
        },
        {
          id: "staging:stg-1",
          name: "Staging Test",
          variables: [{ key: "API_URL", value: "https://api.staging.com", enabled: true, is_secret: false }],
        },
        {
          id: "local:loc-1",
          name: "Local Dev",
          variables: [{ key: "API_URL", value: "http://localhost:3000", enabled: true, is_secret: false }],
        },
      ],
      activeGroup: "local",
      groupActiveIds: {
        production: "production:prod-1",
        staging: "staging:stg-1",
        local: "local:loc-1",
      },
      activeId: "local:loc-1",
      isModalOpen: false,
    });
  });

  it("updates activeGroup and activeId synchronously when transitioning groups", () => {
    const store = useEnvStore.getState();
    expect(store.activeGroup).toBe("local");
    expect(store.activeId).toBe("local:loc-1");

    store.setActiveGroup("staging");
    const stgState = useEnvStore.getState();
    expect(stgState.activeGroup).toBe("staging");
    expect(stgState.activeId).toBe("staging:stg-1");

    store.setActiveGroup("production");
    const prodState = useEnvStore.getState();
    expect(prodState.activeGroup).toBe("production");
    expect(prodState.activeId).toBe("production:prod-1");
  });

  it("opens modal and sets active group when openEnvironmentWindow is called", async () => {
    expect(useEnvStore.getState().isModalOpen).toBe(false);

    await openEnvironmentWindow("staging");

    const state = useEnvStore.getState();
    expect(state.isModalOpen).toBe(true);
    expect(state.activeGroup).toBe("staging");
    expect(state.activeId).toBe("staging:stg-1");
  });

  it("closes modal cleanly with setModalOpen(false)", () => {
    useEnvStore.getState().setModalOpen(true);
    expect(useEnvStore.getState().isModalOpen).toBe(true);

    useEnvStore.getState().setModalOpen(false);
    expect(useEnvStore.getState().isModalOpen).toBe(false);
  });
});

