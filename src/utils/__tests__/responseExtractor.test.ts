import { describe, it, expect } from "vitest";
import {
  getNestedValue,
  formatExtractedValue,
  extractValueFromResponse,
  runResponseExtractors,
} from "../responseExtractor";
import { BoltResponse, ResponseExtractor } from "../../store/requestStore";

describe("responseExtractor", () => {
  describe("getNestedValue", () => {
    const sample = {
      token: "root-token-123",
      data: {
        user: {
          id: 99,
          email: "alice@example.com",
        },
        items: [{ id: "item-a" }, { id: "item-b" }],
      },
      flag: true,
      nullable: null,
    };

    it("accesses top-level properties", () => {
      expect(getNestedValue(sample, "token")).toBe("root-token-123");
      expect(getNestedValue(sample, "flag")).toBe(true);
    });

    it("accesses nested properties with dot notation", () => {
      expect(getNestedValue(sample, "data.user.id")).toBe(99);
      expect(getNestedValue(sample, "data.user.email")).toBe("alice@example.com");
    });

    it("handles $. JSONPath prefix gracefully", () => {
      expect(getNestedValue(sample, "$.data.user.id")).toBe(99);
      expect(getNestedValue(sample, "$.token")).toBe("root-token-123");
    });

    it("accesses array elements via bracket and dot notation", () => {
      expect(getNestedValue(sample, "data.items[0].id")).toBe("item-a");
      expect(getNestedValue(sample, "data.items.1.id")).toBe("item-b");
    });

    it("returns null for non-existent paths safely", () => {
      expect(getNestedValue(sample, "data.unknown.prop")).toBeNull();
      expect(getNestedValue(sample, "nonexistent")).toBeNull();
      expect(getNestedValue(null, "token")).toBeNull();
    });
  });

  describe("formatExtractedValue", () => {
    it("formats primitives into strings", () => {
      expect(formatExtractedValue("hello")).toBe("hello");
      expect(formatExtractedValue(123)).toBe("123");
      expect(formatExtractedValue(true)).toBe("true");
      expect(formatExtractedValue(false)).toBe("false");
    });

    it("stringifies objects and arrays", () => {
      expect(formatExtractedValue({ a: 1 })).toBe('{"a":1}');
      expect(formatExtractedValue([1, 2])).toBe("[1,2]");
    });

    it("returns null for null or undefined", () => {
      expect(formatExtractedValue(null)).toBeNull();
      expect(formatExtractedValue(undefined)).toBeNull();
    });
  });

  describe("extractValueFromResponse", () => {
    const mockResponse: BoltResponse = {
      status: 201,
      status_text: "Created",
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "Authorization", value: "Bearer jwt-token-abc", enabled: true },
        { key: "X-Trace-Id", value: "trace-987", enabled: true },
      ],
      body: JSON.stringify({
        data: {
          token: "jwt-token-abc",
          user: { id: 42, role: "admin" },
        },
      }),
      time_ms: 120,
      size_bytes: 512,
    };

    it("extracts from JSON response body", () => {
      const ext: ResponseExtractor = {
        id: "1",
        source: "body",
        property: "data.token",
        targetVariable: "authToken",
        enabled: true,
      };
      expect(extractValueFromResponse(mockResponse, ext)).toBe("jwt-token-abc");
    });

    it("extracts numeric body fields as strings", () => {
      const ext: ResponseExtractor = {
        id: "2",
        source: "body",
        property: "data.user.id",
        targetVariable: "userId",
        enabled: true,
      };
      expect(extractValueFromResponse(mockResponse, ext)).toBe("42");
    });

    it("extracts headers case-insensitively", () => {
      const ext: ResponseExtractor = {
        id: "3",
        source: "header",
        property: "x-trace-id",
        targetVariable: "traceId",
        enabled: true,
      };
      expect(extractValueFromResponse(mockResponse, ext)).toBe("trace-987");
    });

    it("extracts status code", () => {
      const ext: ResponseExtractor = {
        id: "4",
        source: "status",
        property: "",
        targetVariable: "lastStatus",
        enabled: true,
      };
      expect(extractValueFromResponse(mockResponse, ext)).toBe("201");
    });

    it("returns null when extractor is disabled", () => {
      const ext: ResponseExtractor = {
        id: "5",
        source: "body",
        property: "data.token",
        targetVariable: "authToken",
        enabled: false,
      };
      expect(extractValueFromResponse(mockResponse, ext)).toBeNull();
    });

    it("returns null if response body is not valid JSON", () => {
      const nonJsonResponse: BoltResponse = {
        ...mockResponse,
        body: "Plain text response",
      };
      const ext: ResponseExtractor = {
        id: "6",
        source: "body",
        property: "data.token",
        targetVariable: "authToken",
        enabled: true,
      };
      expect(extractValueFromResponse(nonJsonResponse, ext)).toBeNull();
    });
  });

  describe("runResponseExtractors", () => {
    const mockResponse: BoltResponse = {
      status: 200,
      status_text: "OK",
      headers: [{ key: "X-Request-Id", value: "req-12345", enabled: true }],
      body: JSON.stringify({ token: "sess-abc", userId: 10 }),
      time_ms: 80,
      size_bytes: 100,
    };

    it("runs multiple enabled extractors and returns results", () => {
      const extractors: ResponseExtractor[] = [
        {
          id: "1",
          source: "body",
          property: "token",
          targetVariable: "authToken",
          enabled: true,
        },
        {
          id: "2",
          source: "header",
          property: "x-request-id",
          targetVariable: "requestId",
          enabled: true,
        },
        {
          id: "3",
          source: "status",
          property: "",
          targetVariable: "status",
          enabled: true,
        },
        {
          id: "4",
          source: "body",
          property: "userId",
          targetVariable: "uid",
          enabled: false, // disabled, should be skipped
        },
      ];

      const results = runResponseExtractors(mockResponse, extractors);
      expect(results).toEqual([
        { targetVariable: "authToken", value: "sess-abc", source: "body" },
        { targetVariable: "requestId", value: "req-12345", source: "header" },
        { targetVariable: "status", value: "200", source: "status" },
      ]);
    });

    it("returns empty array when extractors list is empty or undefined", () => {
      expect(runResponseExtractors(mockResponse, [])).toEqual([]);
      expect(runResponseExtractors(mockResponse, undefined)).toEqual([]);
    });
  });
});

