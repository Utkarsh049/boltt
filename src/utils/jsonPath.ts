import { JSONPath } from "jsonpath-plus";

export interface JsonPathFilterResult {
  success: boolean;
  result?: unknown;
  formatted?: string;
  count: number;
  error?: string;
}

/**
 * Evaluates a JSONPath query against a JavaScript object in memory.
 * Supports standard syntax like `$.items[*].id`, `$.store.book[0]`, `users[?(@.active)]`,
 * and automatically normalizes missing `$` root prefixes.
 */
export const evaluateJsonPath = (jsonObj: unknown, path: string): JsonPathFilterResult => {
  const cleanPath = path.trim();
  if (!cleanPath) {
    return {
      success: true,
      result: jsonObj,
      formatted: JSON.stringify(jsonObj, null, 2),
      count: Array.isArray(jsonObj) ? jsonObj.length : 1,
    };
  }

  // Auto-prepend '$' if user omitted it
  let normalizedPath = cleanPath;
  if (!normalizedPath.startsWith("$")) {
    if (normalizedPath.startsWith("[")) {
      normalizedPath = `$${normalizedPath}`;
    } else {
      normalizedPath = `$.${normalizedPath}`;
    }
  }

  try {
    const matches = JSONPath({
      path: normalizedPath,
      json: jsonObj as object,
      wrap: true,
    });

    const count = Array.isArray(matches) ? matches.length : 1;
    // If exact single match wrapped in array of length 1 and path targeted specific element
    return {
      success: true,
      result: matches,
      formatted: JSON.stringify(matches, null, 2),
      count,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      error: err?.message || "Invalid JSONPath expression",
    };
  }
};

