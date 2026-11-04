import {
  BoltRequest,
  HttpMethod,
  KeyValue,
  RequestBody,
  AuthConfig,
} from "../store/requestStore";

export interface ParsedCurlResult {
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  ssl_verify: boolean;
}

export const buildCurlCommand = (request: BoltRequest): string => {
  const method = request.method.toUpperCase();

  // Construct URL with query parameters
  let rawUrl = request.url.trim();
  if (rawUrl && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl) && !rawUrl.startsWith("{{")) {
    rawUrl = `http://${rawUrl}`;
  }

  const query = request.params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${p.key}=${encodeURIComponent(p.value)}`)
    .join("&");
  
  let urlWithParams = rawUrl;
  if (query) {
    const hashIdx = rawUrl.indexOf("#");
    let baseUrl = rawUrl;
    let fragment = "";
    if (hashIdx !== -1) {
      baseUrl = rawUrl.substring(0, hashIdx);
      fragment = rawUrl.substring(hashIdx);
    }
    const separator = baseUrl.includes("?") ? "&" : "?";
    urlWithParams = `${baseUrl}${separator}${query}${fragment}`;
  }
  let curl = `curl -X ${method} "${urlWithParams}"`;

  // Append enabled headers
  request.headers.forEach((h) => {
    if (h.enabled && h.key) {
      curl += ` \\\n  -H "${h.key}: ${h.value}"`;
    }
  });

  // Append auth headers
  if (request.auth.type === "Bearer" && request.auth.config?.token) {
    curl += ` \\\n  -H "Authorization: Bearer ${request.auth.config.token}"`;
  } else if (request.auth.type === "Basic" && request.auth.config) {
    const { username, password } = request.auth.config;
    if (username || password) {
      const credentials = btoa(`${username}:${password}`);
      curl += ` \\\n  -H "Authorization: Basic ${credentials}"`;
    }
  }

  // Append Body content (only for POST/PUT/PATCH/DELETE)
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (request.body.type === "Json" && request.body.content) {
      // Escape single quotes in JSON string
      const escapedBody = request.body.content.replace(/'/g, "'\\''");
      curl += ` \\\n  --data '${escapedBody}'`;
    } else if (request.body.type === "Raw" && request.body.content) {
      const escapedBody = request.body.content.replace(/'/g, "'\\''");
      curl += ` \\\n  --data '${escapedBody}'`;
    } else if (request.body.type === "FormData" && Array.isArray(request.body.content)) {
      request.body.content.forEach((formRow) => {
        if (formRow.enabled && formRow.key) {
          curl += ` \\\n  -F "${formRow.key}=${formRow.value}"`;
        }
      });
    }
  }

  // Append insecure flag if ssl_verify is false
  if (request.ssl_verify === false) {
    curl += ` \\\n  --insecure`;
  }

  return curl;
};

/**
 * Checks if the given text represents a cURL command.
 * Tolerates leading shell prompt characters ($, >, #) and leading whitespace.
 */
export const isCurlCommand = (input: string): boolean => {
  if (!input || typeof input !== "string") return false;
  const trimmed = input.trim();
  const withoutPrompt = trimmed.replace(/^[$>#]\s+/, "");
  return /^curl(\s|$)/.test(withoutPrompt);
};

const decodeSafe = (str: string): string => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

const decodeBase64 = (str: string): string => {
  try {
    if (typeof atob === "function") {
      return atob(str);
    }
    const maybeBuffer = (
      globalThis as unknown as {
        Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
      }
    ).Buffer;
    if (maybeBuffer) {
      return maybeBuffer.from(str, "base64").toString("utf-8");
    }
  } catch {
    // Ignore invalid base64
  }
  return "";
};

/**
 * Robust shell argument tokenizer.
 * Respects single/double quotes, escaped characters, and multi-line continuations.
 */
export const tokenizeShellArgs = (cmd: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const cleaned = cmd
    .trim()
    .replace(/^[$>#]\s+/, "")
    .replace(/\\\r?\n/g, " ");

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (char === "\\" && !inSingleQuote) {
      if (i + 1 < cleaned.length) {
        current += cleaned[i + 1];
        i++;
      }
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
};

/**
 * Separates query parameters from the URL base path into structured KeyValue items.
 */
export const parseUrlAndParams = (rawUrl: string): { cleanUrl: string; params: KeyValue[] } => {
  let cleanUrl = rawUrl.trim();
  const params: KeyValue[] = [];
  const qIndex = cleanUrl.indexOf("?");

  if (qIndex !== -1) {
    const hashIndex = cleanUrl.indexOf("#", qIndex);
    const queryString =
      hashIndex !== -1 ? cleanUrl.substring(qIndex + 1, hashIndex) : cleanUrl.substring(qIndex + 1);
    const fragment = hashIndex !== -1 ? cleanUrl.substring(hashIndex) : "";
    cleanUrl = cleanUrl.substring(0, qIndex) + fragment;

    const pairs = queryString.split("&");
    for (const pair of pairs) {
      if (!pair) continue;
      const eqIdx = pair.indexOf("=");
      if (eqIdx !== -1) {
        params.push({
          key: decodeSafe(pair.substring(0, eqIdx)),
          value: decodeSafe(pair.substring(eqIdx + 1)),
          enabled: true,
        });
      } else {
        params.push({
          key: decodeSafe(pair),
          value: "",
          enabled: true,
        });
      }
    }
  }

  return { cleanUrl, params };
};

/**
 * Parses a raw cURL command string into a structured BoltRequest object.
 * Returns null if the command is not a valid cURL invocation or has no URL.
 */
export const parseCurlCommand = (curlStr: string): ParsedCurlResult | null => {
  if (!isCurlCommand(curlStr)) return null;

  const tokens = tokenizeShellArgs(curlStr);
  if (tokens.length === 0 || tokens[0] !== "curl") return null;

  let rawMethod = "";
  let rawUrl = "";
  const rawHeaders: string[] = [];
  const dataParts: string[] = [];
  const formParts: string[] = [];
  let basicAuthStr: string | null = null;
  let insecure = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // Method flags: -X, --request
    if (token === "-X" || token === "--request") {
      rawMethod = tokens[++i] || "";
    } else if (token.startsWith("-X")) {
      rawMethod = token.slice(2);
    } else if (token.startsWith("--request=")) {
      rawMethod = token.slice(10);
    }
    // Header flags: -H, --header
    else if (token === "-H" || token === "--header") {
      rawHeaders.push(tokens[++i] || "");
    } else if (token.startsWith("-H")) {
      rawHeaders.push(token.slice(2));
    } else if (token.startsWith("--header=")) {
      rawHeaders.push(token.slice(9));
    }
    // Data flags: -d, --data, --data-raw, --data-binary, --data-ascii, --data-urlencode
    else if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary" ||
      token === "--data-ascii" ||
      token === "--data-urlencode"
    ) {
      dataParts.push(tokens[++i] || "");
    } else if (token.startsWith("-d")) {
      dataParts.push(token.slice(2));
    } else if (
      token.startsWith("--data=") ||
      token.startsWith("--data-raw=") ||
      token.startsWith("--data-binary=") ||
      token.startsWith("--data-ascii=") ||
      token.startsWith("--data-urlencode=")
    ) {
      dataParts.push(token.slice(token.indexOf("=") + 1));
    }
    // Form flags: -F, --form
    else if (token === "-F" || token === "--form") {
      formParts.push(tokens[++i] || "");
    } else if (token.startsWith("-F")) {
      formParts.push(token.slice(2));
    } else if (token.startsWith("--form=")) {
      formParts.push(token.slice(7));
    }
    // User / Basic auth: -u, --user
    else if (token === "-u" || token === "--user") {
      basicAuthStr = tokens[++i] || "";
    } else if (token.startsWith("-u")) {
      basicAuthStr = token.slice(2);
    } else if (token.startsWith("--user=")) {
      basicAuthStr = token.slice(7);
    }
    // Insecure / SSL: -k, --insecure
    else if (token === "-k" || token === "--insecure") {
      insecure = true;
    }
    // Head request: -I, --head
    else if (token === "-I" || token === "--head") {
      rawMethod = "HEAD";
    }
    // User agent: -A, --user-agent
    else if (token === "-A" || token === "--user-agent") {
      rawHeaders.push(`User-Agent: ${tokens[++i] || ""}`);
    }
    // Cookie: -b, --cookie
    else if (token === "-b" || token === "--cookie") {
      rawHeaders.push(`Cookie: ${tokens[++i] || ""}`);
    }
    // Explicit URL flag: --url
    else if (token === "--url") {
      rawUrl = tokens[++i] || "";
    } else if (token.startsWith("--url=")) {
      rawUrl = token.slice(6);
    }
    // Positional URL
    else if (!token.startsWith("-") && !rawUrl) {
      rawUrl = token;
    }
  }

  if (!rawUrl) return null;

  const validMethods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  let method = (rawMethod ? rawMethod.toUpperCase() : "") as HttpMethod;
  if (!method) {
    method = dataParts.length > 0 || formParts.length > 0 ? "POST" : "GET";
  }
  if (!validMethods.includes(method)) {
    method = "GET";
  }

  const { cleanUrl, params } = parseUrlAndParams(rawUrl);

  let auth: AuthConfig = { type: "None" };
  const headers: KeyValue[] = [];

  if (basicAuthStr) {
    const colonIdx = basicAuthStr.indexOf(":");
    const username = colonIdx !== -1 ? basicAuthStr.slice(0, colonIdx) : basicAuthStr;
    const password = colonIdx !== -1 ? basicAuthStr.slice(colonIdx + 1) : "";
    auth = { type: "Basic", config: { username, password } };
  }

  for (const h of rawHeaders) {
    const colonIdx = h.indexOf(":");
    if (colonIdx === -1) continue;
    const key = h.slice(0, colonIdx).trim();
    const value = h.slice(colonIdx + 1).trim();
    if (!key) continue;

    // Detect Authorization headers to map to the Auth tab
    if (key.toLowerCase() === "authorization") {
      if (value.toLowerCase().startsWith("bearer ")) {
        auth = { type: "Bearer", config: { token: value.slice(7).trim() } };
        continue;
      }
      if (value.toLowerCase().startsWith("basic ") && !basicAuthStr) {
        const decoded = decodeBase64(value.slice(6).trim());
        if (decoded) {
          const cIdx = decoded.indexOf(":");
          const username = cIdx !== -1 ? decoded.slice(0, cIdx) : decoded;
          const password = cIdx !== -1 ? decoded.slice(cIdx + 1) : "";
          auth = { type: "Basic", config: { username, password } };
          continue;
        }
      }
    }

    headers.push({ key, value, enabled: true });
  }

  let body: RequestBody = { type: "None" };
  if (formParts.length > 0) {
    const formRows: KeyValue[] = [];
    for (const f of formParts) {
      const eqIdx = f.indexOf("=");
      if (eqIdx !== -1) {
        formRows.push({
          key: f.slice(0, eqIdx).trim(),
          value: f.slice(eqIdx + 1).trim(),
          enabled: true,
        });
      } else {
        formRows.push({ key: f.trim(), value: "", enabled: true });
      }
    }
    body = { type: "FormData", content: formRows };
  } else if (dataParts.length > 0) {
    const rawData = dataParts.join("&");
    try {
      const parsed = JSON.parse(rawData);
      body = { type: "Json", content: JSON.stringify(parsed, null, 2) };
    } catch {
      body = { type: "Raw", content: rawData };
    }
  }

  // Derive request name from URL path
  let name = "Imported Request";
  try {
    const urlWithoutQuery = rawUrl.split("?")[0];
    const segments = urlWithoutQuery.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "").split("/").filter(Boolean);
    if (segments.length > 1) {
      name = segments[segments.length - 1];
    } else if (segments.length === 1) {
      name = segments[0];
    }
  } catch {
    // Keep default name
  }

  return {
    name,
    method,
    url: cleanUrl,
    headers,
    params,
    body,
    auth,
    ssl_verify: !insecure,
  };
};
