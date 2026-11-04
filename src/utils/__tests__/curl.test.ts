import { describe, it, expect } from "vitest";
import {
  buildCurlCommand,
  isCurlCommand,
  tokenizeShellArgs,
  parseUrlAndParams,
  parseCurlCommand,
} from "../curl";
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

describe("isCurlCommand", () => {
  it("detects standard curl commands", () => {
    expect(isCurlCommand("curl https://httpbin.org/get")).toBe(true);
    expect(isCurlCommand("curl -X POST https://httpbin.org/post")).toBe(true);
  });

  it("tolerates terminal prompts and leading whitespace", () => {
    expect(isCurlCommand("  $ curl https://httpbin.org/get")).toBe(true);
    expect(isCurlCommand("> curl -X GET https://httpbin.org/get")).toBe(true);
    expect(isCurlCommand("# curl https://httpbin.org/get")).toBe(true);
  });

  it("returns false for non-curl strings", () => {
    expect(isCurlCommand("https://httpbin.org/get")).toBe(false);
    expect(isCurlCommand("GET /api/v1/users")).toBe(false);
    expect(isCurlCommand('{"name":"Alice"}')).toBe(false);
    expect(isCurlCommand("curling is a sport")).toBe(false);
    expect(isCurlCommand("")).toBe(false);
  });
});

describe("tokenizeShellArgs", () => {
  it("tokenizes simple arguments", () => {
    const tokens = tokenizeShellArgs("curl -X GET https://example.com");
    expect(tokens).toEqual(["curl", "-X", "GET", "https://example.com"]);
  });

  it("handles single-quoted and double-quoted strings", () => {
    const tokens = tokenizeShellArgs(
      'curl -H \'Content-Type: application/json\' -d "{\\"active\\": true}" https://example.com'
    );
    expect(tokens).toEqual([
      "curl",
      "-H",
      "Content-Type: application/json",
      "-d",
      '{"active": true}',
      "https://example.com",
    ]);
  });

  it("handles multi-line backslash continuations", () => {
    const cmd = `curl -X POST \\\n  https://example.com \\\n  -H "Accept: application/json"`;
    const tokens = tokenizeShellArgs(cmd);
    expect(tokens).toEqual(["curl", "-X", "POST", "https://example.com", "-H", "Accept: application/json"]);
  });
});

describe("parseUrlAndParams", () => {
  it("extracts query parameters into KeyValue objects", () => {
    const { cleanUrl, params } = parseUrlAndParams("https://api.example.com/search?query=boltt&limit=10");
    expect(cleanUrl).toBe("https://api.example.com/search");
    expect(params).toEqual([
      { key: "query", value: "boltt", enabled: true },
      { key: "limit", value: "10", enabled: true },
    ]);
  });

  it("preserves hash fragments after cleaning query", () => {
    const { cleanUrl, params } = parseUrlAndParams("https://api.example.com/items?filter=active#details");
    expect(cleanUrl).toBe("https://api.example.com/items#details");
    expect(params).toEqual([{ key: "filter", value: "active", enabled: true }]);
  });

  it("handles URLs without query strings", () => {
    const { cleanUrl, params } = parseUrlAndParams("https://api.example.com/v1/users");
    expect(cleanUrl).toBe("https://api.example.com/v1/users");
    expect(params).toEqual([]);
  });
});

describe("parseCurlCommand", () => {
  it("returns null for non-curl strings or commands without URL", () => {
    expect(parseCurlCommand("not a curl command")).toBeNull();
    expect(parseCurlCommand("curl -X GET")).toBeNull();
  });

  it("parses a simple GET cURL command", () => {
    const result = parseCurlCommand("curl https://httpbin.org/get");
    expect(result).not.toBeNull();
    expect(result!.method).toBe("GET");
    expect(result!.url).toBe("https://httpbin.org/get");
    expect(result!.headers).toEqual([]);
    expect(result!.auth).toEqual({ type: "None" });
    expect(result!.ssl_verify).toBe(true);
  });

  it("parses POST request with JSON body and Bearer token", () => {
    const cmd = `curl -X POST https://api.github.com/repos/Utkarsh049/boltt/issues \\\n  -H "Authorization: Bearer ghp_token123" \\\n  -H "Accept: application/vnd.github+json" \\\n  -d '{"title":"Bug in import"}'`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("POST");
    expect(result!.url).toBe("https://api.github.com/repos/Utkarsh049/boltt/issues");
    expect(result!.auth).toEqual({
      type: "Bearer",
      config: { token: "ghp_token123" },
    });
    expect(result!.headers).toEqual([
      { key: "Accept", value: "application/vnd.github+json", enabled: true },
    ]);
    expect(result!.body.type).toBe("Json");
    expect(JSON.parse((result!.body as { type: "Json"; content: string }).content)).toEqual({
      title: "Bug in import",
    });
  });

  it("infers POST method when data payload is provided without -X", () => {
    const cmd = `curl https://api.example.com/users --data-raw '{"name":"Alice"}'`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("POST");
    expect(result!.body.type).toBe("Json");
  });

  it("parses Basic Auth from -u / --user flag", () => {
    const cmd = `curl -u "admin:secret123" https://api.example.com/admin/stats`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.auth).toEqual({
      type: "Basic",
      config: { username: "admin", password: "secret123" },
    });
  });

  it("parses Basic Auth from Authorization: Basic header", () => {
    const b64 = btoa("user:password");
    const cmd = `curl -H "Authorization: Basic ${b64}" https://api.example.com/protected`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.auth).toEqual({
      type: "Basic",
      config: { username: "user", password: "password" },
    });
  });

  it("handles -k and --insecure flag", () => {
    const cmd1 = `curl -k https://self-signed.local`;
    const result1 = parseCurlCommand(cmd1);
    expect(result1?.ssl_verify).toBe(false);

    const cmd2 = `curl --insecure https://self-signed.local`;
    const result2 = parseCurlCommand(cmd2);
    expect(result2?.ssl_verify).toBe(false);
  });

  it("parses multipart form data with -F / --form flags", () => {
    const cmd = `curl -X POST https://api.example.com/upload -F "file=@photo.png" -F "desc=Profile image"`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.body.type).toBe("FormData");
    expect(result!.body.content).toEqual([
      { key: "file", value: "@photo.png", enabled: true },
      { key: "desc", value: "Profile image", enabled: true },
    ]);
  });

  it("parses URL-encoded form data from multiple -d flags", () => {
    const cmd = `curl https://api.stripe.com/v1/charges -d amount=2000 -d currency=usd`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("POST");
    expect(result!.body.type).toBe("Raw");
    expect(result!.body.content).toBe("amount=2000&currency=usd");
  });

  it("handles combined flags such as -XPOST and -H'Header: Value'", () => {
    const cmd = `curl -XPOST -H'X-Custom: Value' -d'{"ok":true}' https://example.com/api`;
    const result = parseCurlCommand(cmd);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("POST");
    expect(result!.headers).toEqual([{ key: "X-Custom", value: "Value", enabled: true }]);
    expect(result!.body.type).toBe("Json");
  });
});

