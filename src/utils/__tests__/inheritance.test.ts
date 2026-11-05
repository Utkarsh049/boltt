import { describe, it, expect } from "vitest";
import {
  findFolderAncestry,
  resolveEffectiveAuth,
  resolveEffectiveHeaders,
  resolveRequestInheritance,
} from "../inheritance";
import { Project, Folder } from "../../store/projectsStore";
import { BoltRequest, AuthConfig, KeyValue } from "../../store/requestStore";

describe("inheritance", () => {
  const sampleProjects: Project[] = [
    {
      id: "proj-1",
      name: "API Project",
      folders: [
        {
          id: "f-root",
          name: "Root Folder",
          auth: { type: "Bearer", config: { token: "root-token-xyz" } },
          headers: [
            { key: "X-Global-Header", value: "global-123", enabled: true },
            { key: "Accept", value: "application/json", enabled: true },
          ],
          requests: [
            {
              id: "req-root",
              name: "Root Request",
              method: "GET",
              url: "https://api.example.com/root",
              headers: [],
              params: [],
              body: { type: "None" },
              auth: { type: "Inherit" },
            },
          ],
          subfolders: [
            {
              id: "f-nested",
              name: "Nested Folder",
              auth: { type: "Inherit" },
              headers: [
                { key: "X-Nested-Header", value: "nested-456", enabled: true },
                { key: "X-Global-Header", value: "overridden-by-folder", enabled: true },
              ],
              requests: [
                {
                  id: "req-nested",
                  name: "Nested Request",
                  method: "POST",
                  url: "https://api.example.com/nested",
                  headers: [
                    { key: "X-Global-Header", value: "overridden-by-req", enabled: true },
                    { key: "X-Custom-Req", value: "req-val", enabled: true },
                  ],
                  params: [],
                  body: { type: "None" },
                  auth: { type: "Inherit" },
                },
                {
                  id: "req-explicit",
                  name: "Explicit Auth Request",
                  method: "GET",
                  url: "https://api.example.com/explicit",
                  headers: [],
                  params: [],
                  body: { type: "None" },
                  auth: { type: "Basic", config: { username: "admin", password: "secret" } },
                },
              ],
              subfolders: [],
            },
          ],
        },
      ],
    },
  ];

  describe("findFolderAncestry", () => {
    it("finds ancestry for direct folder request", () => {
      const ancestry = findFolderAncestry(sampleProjects, "req-root");
      expect(ancestry).not.toBeNull();
      expect(ancestry?.project.id).toBe("proj-1");
      expect(ancestry?.folderChain.map((f) => f.id)).toEqual(["f-root"]);
    });

    it("finds ancestry for deeply nested request", () => {
      const ancestry = findFolderAncestry(sampleProjects, "req-nested");
      expect(ancestry).not.toBeNull();
      expect(ancestry?.project.id).toBe("proj-1");
      expect(ancestry?.folderChain.map((f) => f.id)).toEqual(["f-root", "f-nested"]);
    });

    it("returns null for non-existent request id", () => {
      const ancestry = findFolderAncestry(sampleProjects, "non-existent");
      expect(ancestry).toBeNull();
    });

    it("returns null for empty project list or null request id", () => {
      expect(findFolderAncestry([], "req-root")).toBeNull();
      expect(findFolderAncestry(sampleProjects, "")).toBeNull();
    });
  });

  describe("resolveEffectiveAuth", () => {
    const rootFolder: Folder = {
      id: "f1",
      name: "Security",
      auth: { type: "Bearer", config: { token: "token-99" } },
      requests: [],
      subfolders: [],
    };

    const subFolder: Folder = {
      id: "f2",
      name: "Users",
      auth: { type: "Inherit" },
      requests: [],
      subfolders: [],
    };

    it("inherits auth from nearest parent with explicit auth", () => {
      const res = resolveEffectiveAuth({ type: "Inherit" }, [rootFolder, subFolder]);
      expect(res.effectiveAuth).toEqual({
        type: "Bearer",
        config: { token: "token-99" },
      });
      expect(res.inheritedFromFolderName).toBe("Security");
    });

    it("prefers closer parent folder if it defines its own auth", () => {
      const customSubFolder: Folder = {
        ...subFolder,
        auth: { type: "Basic", config: { username: "sub_user", password: "pwd" } },
      };
      const res = resolveEffectiveAuth({ type: "Inherit" }, [rootFolder, customSubFolder]);
      expect(res.effectiveAuth).toEqual({
        type: "Basic",
        config: { username: "sub_user", password: "pwd" },
      });
      expect(res.inheritedFromFolderName).toBe("Users");
    });

    it("does not override request when request has explicit auth", () => {
      const explicitAuth: AuthConfig = {
        type: "Basic",
        config: { username: "custom", password: "123" },
      };
      const res = resolveEffectiveAuth(explicitAuth, [rootFolder, subFolder]);
      expect(res.effectiveAuth).toEqual(explicitAuth);
      expect(res.inheritedFromFolderName).toBeUndefined();
    });

    it("does not override request when request is set to None", () => {
      const res = resolveEffectiveAuth({ type: "None" }, [rootFolder, subFolder]);
      expect(res.effectiveAuth).toEqual({ type: "None" });
      expect(res.inheritedFromFolderName).toBeUndefined();
    });

    it("falls back to None if no ancestor defines auth", () => {
      const emptyFolder: Folder = {
        id: "f0",
        name: "Empty",
        requests: [],
        subfolders: [],
      };
      const res = resolveEffectiveAuth({ type: "Inherit" }, [emptyFolder]);
      expect(res.effectiveAuth).toEqual({ type: "None" });
      expect(res.inheritedFromFolderName).toBeUndefined();
    });
  });

  describe("resolveEffectiveHeaders", () => {
    it("cascades headers down hierarchy with child and request overriding matching keys", () => {
      const f1: Folder = {
        id: "f1",
        name: "Root",
        headers: [
          { key: "X-Trace", value: "trace-1", enabled: true },
          { key: "Accept", value: "application/json", enabled: true },
        ],
        requests: [],
        subfolders: [],
      };

      const f2: Folder = {
        id: "f2",
        name: "Child",
        headers: [
          { key: "x-trace", value: "trace-2-overridden", enabled: true },
          { key: "X-Child", value: "child-val", enabled: true },
        ],
        requests: [],
        subfolders: [],
      };

      const requestHeaders: KeyValue[] = [
        { key: "X-CHILD", value: "req-overrides-child", enabled: true },
        { key: "Authorization-Custom", value: "custom-auth", enabled: true },
      ];

      const res = resolveEffectiveHeaders(requestHeaders, [f1, f2]);

      expect(res.inheritedHeaders).toEqual([
        { key: "x-trace", value: "trace-2-overridden", enabled: true },
        { key: "Accept", value: "application/json", enabled: true },
        { key: "X-Child", value: "child-val", enabled: true },
      ]);

      expect(res.effectiveHeaders).toEqual([
        { key: "x-trace", value: "trace-2-overridden", enabled: true },
        { key: "Accept", value: "application/json", enabled: true },
        { key: "X-CHILD", value: "req-overrides-child", enabled: true },
        { key: "Authorization-Custom", value: "custom-auth", enabled: true },
      ]);
    });
  });

  describe("resolveRequestInheritance", () => {
    it("resolves both auth and cascading headers together", () => {
      const activeRequest: BoltRequest = {
        id: "req-nested",
        name: "Nested Request",
        method: "POST",
        url: "https://api.example.com/nested",
        headers: [
          { key: "X-Global-Header", value: "overridden-by-req", enabled: true },
          { key: "X-Custom-Req", value: "req-val", enabled: true },
        ],
        params: [],
        body: { type: "None" },
        auth: { type: "Inherit" },
      };

      const result = resolveRequestInheritance(sampleProjects, "req-nested", activeRequest);

      // Inherited from Root Folder
      expect(result.effectiveAuth).toEqual({
        type: "Bearer",
        config: { token: "root-token-xyz" },
      });
      expect(result.inheritedFromFolderName).toBe("Root Folder");

      // Cascading headers
      expect(result.effectiveHeaders.find((h) => h.key.toLowerCase() === "x-global-header")?.value).toBe(
        "overridden-by-req"
      );
      expect(result.effectiveHeaders.find((h) => h.key.toLowerCase() === "x-nested-header")?.value).toBe(
        "nested-456"
      );
      expect(result.effectiveHeaders.find((h) => h.key.toLowerCase() === "accept")?.value).toBe(
        "application/json"
      );
    });

    it("keeps standalone request unchanged if requestId is not in projects", () => {
      const standaloneRequest: BoltRequest = {
        name: "Temp Request",
        method: "GET",
        url: "https://httpbin.org/get",
        headers: [{ key: "X-Temp", value: "temp-val", enabled: true }],
        params: [],
        body: { type: "None" },
        auth: { type: "Bearer", config: { token: "standalone-token" } },
      };

      const result = resolveRequestInheritance(sampleProjects, null, standaloneRequest);
      expect(result.effectiveAuth).toEqual(standaloneRequest.auth);
      expect(result.effectiveHeaders).toEqual(standaloneRequest.headers);
      expect(result.inheritedHeaders).toEqual([]);
      expect(result.inheritedFromFolderName).toBeUndefined();
    });
  });
});

