import { BoltResponse, ResponseExtractor } from "../store/requestStore";

/**
 * Accesses a nested property in an object using dot or bracket notation.
 * e.g. "data.token", "$.user.id", "items[0].name", "items.0.name".
 */
export const getNestedValue = (obj: unknown, path: string): unknown => {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return null;
  }

  const cleanPath = path
    .trim()
    .replace(/^\$\.?/, "")
    .replace(/\[(\w+)\]/g, ".$1")
    .trim();

  if (!cleanPath) return obj;

  const parts = cleanPath.split(".").filter(Boolean);
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return null;
    }
    current = current[part];
  }

  return current === undefined ? null : current;
};

/**
 * Formats an extracted value into a clean string suitable for an environment variable.
 */
export const formatExtractedValue = (val: unknown): string | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") {
    return String(val);
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return String(val);
};

/**
 * Extracts a value from a response based on a ResponseExtractor definition.
 */
export const extractValueFromResponse = (
  response: BoltResponse,
  extractor: ResponseExtractor
): string | null => {
  if (!extractor.enabled) return null;

  switch (extractor.source) {
    case "body": {
      if (!response.body) return null;
      try {
        const parsedJson = JSON.parse(response.body);
        const rawValue = getNestedValue(parsedJson, extractor.property);
        return formatExtractedValue(rawValue);
      } catch {
        return null;
      }
    }
    case "header": {
      if (!response.headers || response.headers.length === 0) return null;
      const targetHeader = extractor.property.trim().toLowerCase();
      const match = response.headers.find(
        (h) => h.key.trim().toLowerCase() === targetHeader
      );
      return match ? match.value : null;
    }
    case "status": {
      return String(response.status);
    }
    default:
      return null;
  }
};

export interface ExtractedResult {
  targetVariable: string;
  value: string;
  source: string;
}

/**
 * Evaluates all enabled extractors for a response.
 */
export const runResponseExtractors = (
  response: BoltResponse,
  extractors?: ResponseExtractor[]
): ExtractedResult[] => {
  if (!extractors || extractors.length === 0) return [];

  const results: ExtractedResult[] = [];
  for (const ext of extractors) {
    if (!ext.enabled || !ext.targetVariable.trim()) continue;
    const val = extractValueFromResponse(response, ext);
    if (val !== null) {
      results.push({
        targetVariable: ext.targetVariable.trim(),
        value: val,
        source: ext.source,
      });
    }
  }
  return results;
};
