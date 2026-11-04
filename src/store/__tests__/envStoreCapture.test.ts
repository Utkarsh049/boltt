import { describe, it, expect, beforeEach, vi } from "vitest";

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
  return { mockStorage: storage };
});

// Mock Tauri modules
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: class {},
}));

import { useEnvStore, Environment } from "../envStore";

describe("envStore - variable capture", () => {
  beforeEach(() => {
    mockStorage.clear();
    useEnvStore.setState({
      environments: [],
      activeGroup: "local",
      groupActiveIds: { production: null, staging: null, local: null },
      activeId: null,
      isModalOpen: false,
    });
  });

  it("creates a default environment if none exist when capturing a variable", async () => {
    const success = await useEnvStore.getState().setVariableInActiveEnvironment("auth_token", "secret123");
    expect(success).toBe(true);

    const envs = useEnvStore.getState().environments;
    expect(envs.length).toBe(1);
    expect(envs[0].name).toBe("Default");
    expect(envs[0].variables).toEqual([
      { key: "auth_token", value: "secret123", enabled: true },
    ]);
  });

  it("appends a new variable into active environment", async () => {
    const initialEnv: Environment = {
      id: "local:dev",
      name: "Dev",
      variables: [{ key: "baseUrl", value: "https://api.dev", enabled: true }],
    };

    useEnvStore.setState({
      environments: [initialEnv],
      activeGroup: "local",
      groupActiveIds: { production: null, staging: null, local: "local:dev" },
      activeId: "local:dev",
    });

    const success = await useEnvStore.getState().setVariableInActiveEnvironment("token", "xyz-789");
    expect(success).toBe(true);

    const updated = useEnvStore.getState().environments.find((e) => e.id === "local:dev");
    expect(updated?.variables).toEqual([
      { key: "baseUrl", value: "https://api.dev", enabled: true },
      { key: "token", value: "xyz-789", enabled: true },
    ]);
  });

  it("updates existing variable value in active environment if key matches case-insensitively", async () => {
    const initialEnv: Environment = {
      id: "local:dev",
      name: "Dev",
      variables: [{ key: "API_TOKEN", value: "old_val", enabled: false }],
    };

    useEnvStore.setState({
      environments: [initialEnv],
      activeGroup: "local",
      groupActiveIds: { production: null, staging: null, local: "local:dev" },
      activeId: "local:dev",
    });

    const success = await useEnvStore.getState().setVariableInActiveEnvironment("api_token", "new_val");
    expect(success).toBe(true);

    const updated = useEnvStore.getState().environments.find((e) => e.id === "local:dev");
    expect(updated?.variables.length).toBe(1);
    expect(updated?.variables[0]).toEqual({
      key: "api_token",
      value: "new_val",
      enabled: true,
    });
  });

  it("strips curly braces {{ }} from variable names automatically", async () => {
    const initialEnv: Environment = {
      id: "local:dev",
      name: "Dev",
      variables: [],
    };

    useEnvStore.setState({
      environments: [initialEnv],
      activeGroup: "local",
      groupActiveIds: { production: null, staging: null, local: "local:dev" },
      activeId: "local:dev",
    });

    await useEnvStore.getState().setVariableInActiveEnvironment("{{session_id}}", "sess_999");
    const updated = useEnvStore.getState().environments.find((e) => e.id === "local:dev");
    expect(updated?.variables[0].key).toBe("session_id");
    expect(updated?.variables[0].value).toBe("sess_999");
  });

  it("reflects captured variable in getFlatActiveVariables", async () => {
    const initialEnv: Environment = {
      id: "local:dev",
      name: "Dev",
      variables: [],
    };

    useEnvStore.setState({
      environments: [initialEnv],
      activeGroup: "local",
      groupActiveIds: { production: null, staging: null, local: "local:dev" },
      activeId: "local:dev",
    });

    await useEnvStore.getState().setVariableInActiveEnvironment("apiKey", "key-456");
    const flat = useEnvStore.getState().getFlatActiveVariables();
    expect(flat["apiKey"]).toBe("key-456");
  });
});
