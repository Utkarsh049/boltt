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

describe("envStore - Git-Safe Secrets Separation", () => {
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

  it("identifies secret keys correctly with getSecretKeys()", () => {
    const env: Environment = {
      id: "local:env-1",
      name: "Local Dev",
      variables: [
        { key: "API_URL", value: "http://localhost:3000", enabled: true, is_secret: false },
        { key: "JWT_SECRET", value: "shhh_secret_key", enabled: true, is_secret: true },
        { key: "DB_PASS", value: "superpass", enabled: false, is_secret: true },
        { key: "PUBLIC_KEY", value: "pub_123", enabled: true },
      ],
    };

    useEnvStore.setState({
      environments: [env],
      activeId: "local:env-1",
    });

    const secretKeys = useEnvStore.getState().getSecretKeys();
    expect(secretKeys.has("JWT_SECRET")).toBe(true);
    expect(secretKeys.has("DB_PASS")).toBe(true);
    expect(secretKeys.has("API_URL")).toBe(false);
    expect(secretKeys.has("PUBLIC_KEY")).toBe(false);
  });

  it("returns all enabled variables (including secrets) in getFlatActiveVariables() for request interpolation", () => {
    const env: Environment = {
      id: "local:env-1",
      name: "Local Dev",
      variables: [
        { key: "API_URL", value: "http://localhost:3000", enabled: true, is_secret: false },
        { key: "AUTH_TOKEN", value: "bearer_xyz_secret", enabled: true, is_secret: true },
        { key: "DISABLED_SECRET", value: "hidden", enabled: false, is_secret: true },
      ],
    };

    useEnvStore.setState({
      environments: [env],
      activeId: "local:env-1",
    });

    const flat = useEnvStore.getState().getFlatActiveVariables();
    expect(flat["API_URL"]).toBe("http://localhost:3000");
    expect(flat["AUTH_TOKEN"]).toBe("bearer_xyz_secret");
    expect(flat["DISABLED_SECRET"]).toBeUndefined();
  });

  it("preserves is_secret flag when setVariableInActiveEnvironment updates an existing secret variable", async () => {
    const env: Environment = {
      id: "local:env-1",
      name: "Local Dev",
      variables: [
        { key: "TOKEN", value: "old-secret-token", enabled: true, is_secret: true },
      ],
    };

    useEnvStore.setState({
      environments: [env],
      activeId: "local:env-1",
    });

    await useEnvStore.getState().setVariableInActiveEnvironment("TOKEN", "new-captured-secret-token");

    const updatedEnv = useEnvStore.getState().environments.find((e) => e.id === "local:env-1");
    expect(updatedEnv).toBeDefined();
    const tokenVar = updatedEnv?.variables.find((v) => v.key === "TOKEN");
    expect(tokenVar?.value).toBe("new-captured-secret-token");
    expect(tokenVar?.is_secret).toBe(true);
  });
});

