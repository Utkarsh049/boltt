import { describe, it, expect } from "vitest";
import { buildCurlCommand } from "../curl";
import { BoltRequest } from "../../store/requestStore";

const createBaseRequest = (overrides: Partial<BoltRequest> = {}): BoltRequest => ({
  id: "test-req-1",
  name: "Test Request",
  method: "GET",
  url: "https://api.example.com/users",
  headers: [],
  params: [],
  body: { type: "None" },
  auth: { type: "None" },
  ssl_verify: true,
  ...overrides,
});

describe("buildCurlCommand", () => {
  it("builds a simple GET command", () => {
    const req = createBaseRequest();
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "https://api.example.com/users"');
  });

  it("auto-prefixes http:// for scheme-less URLs", () => {
    const req = createBaseRequest({ url: "localhost:3000/api/items" });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "http://localhost:3000/api/items"');
  });

  it("preserves template variable URLs without forcing http prefix", () => {
    const req = createBaseRequest({ url: "{{baseUrl}}/health" });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "{{baseUrl}}/health"');
  });

  it("appends query parameters with URL encoding", () => {
    const req = createBaseRequest({
      url: "https://api.example.com/search",
      params: [
        { key: "q", value: "hello world", enabled: true },
        { key: "limit", value: "10", enabled: true },
        { key: "unused", value: "val", enabled: false },
      ],
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "https://api.example.com/search?q=hello%20world&limit=10"');
  });

  it("appends active headers and skips disabled ones", () => {
    const req = createBaseRequest({
      headers: [
        { key: "Accept", value: "application/json", enabled: true },
        { key: "X-Trace-Id", value: "12345", enabled: false },
      ],
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toContain('-H "Accept: application/json"');
    expect(cmd).not.toContain("X-Trace-Id");
  });

  it("appends Bearer authentication header", () => {
    const req = createBaseRequest({
      auth: {
        type: "Bearer",
        config: { token: "secret-token-xyz" },
      },
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toContain('-H "Authorization: Bearer secret-token-xyz"');
  });

  it("appends Basic authentication header with base64 credentials", () => {
    const req = createBaseRequest({
      auth: {
        type: "Basic",
        config: { username: "admin", password: "password123" },
      },
    });
    const cmd = buildCurlCommand(req);
    const expectedB64 = btoa("admin:password123");
    expect(cmd).toContain(`-H "Authorization: Basic ${expectedB64}"`);
  });

  it("appends JSON payload and escapes single quotes for POST", () => {
    const req = createBaseRequest({
      method: "POST",
      body: {
        type: "Json",
        content: JSON.stringify({ name: "O'Reilly" }),
      },
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toContain("curl -X POST");
    expect(cmd).toContain(`--data '{"name":"O'\\''Reilly"}'`);
  });

  it("appends --insecure flag when ssl_verify is false", () => {
    const req = createBaseRequest({ ssl_verify: false });
    const cmd = buildCurlCommand(req);
    expect(cmd).toContain("--insecure");
  });

  it("auto-prefixes http:// when URL contains :// in query or path", () => {
    const req = createBaseRequest({
      url: "localhost:3000/callback?next=https://example.com",
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "http://localhost:3000/callback?next=https://example.com"');
  });

  it("merges params with & when URL already has query parameters", () => {
    const req = createBaseRequest({
      url: "https://api.example.com/items?filter=active",
      params: [{ key: "limit", value: "20", enabled: true }],
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "https://api.example.com/items?filter=active&limit=20"');
  });

  it("inserts query parameters before hash fragment", () => {
    const req = createBaseRequest({
      url: "https://api.example.com/items#section1",
      params: [{ key: "limit", value: "20", enabled: true }],
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "https://api.example.com/items?limit=20#section1"');
  });

  it("merges query and places before hash fragment when both exist", () => {
    const req = createBaseRequest({
      url: "https://api.example.com/items?sort=asc#section1",
      params: [{ key: "limit", value: "20", enabled: true }],
    });
    const cmd = buildCurlCommand(req);
    expect(cmd).toBe('curl -X GET "https://api.example.com/items?sort=asc&limit=20#section1"');
  });
});

