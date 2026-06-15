import { BoltRequest } from "../store/requestStore";

export const buildCurlCommand = (request: BoltRequest): string => {
  const method = request.method.toUpperCase();

  // Construct URL with query parameters
  const query = request.params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${p.key}=${encodeURIComponent(p.value)}`)
    .join("&");
  
  const urlWithParams = query ? `${request.url}?${query}` : request.url;
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
