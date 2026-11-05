import { describe, it, expect } from "vitest";
import { CompletionResult } from "@codemirror/autocomplete";
import {
  DYNAMIC_VARIABLES,
  evaluateDynamicVariable,
  substituteClientVariables,
  createVariableCompletionSource,
} from "../dynamicVariables";

describe("dynamicVariables", () => {
  it("defines standard dynamic variable generators", () => {
    const names = DYNAMIC_VARIABLES.map((v) => v.name);
    expect(names).toContain("$uuid");
    expect(names).toContain("$timestamp");
    expect(names).toContain("$isoTimestamp");
    expect(names).toContain("$randomInt");
    expect(names).toContain("$randomEmail");
    expect(names).toContain("$randomAlphaNumeric");
  });

  describe("evaluateDynamicVariable", () => {
    it("generates a valid UUID v4 for $uuid", () => {
      const val1 = evaluateDynamicVariable("$uuid");
      const val2 = evaluateDynamicVariable("{{$uuid}}");

      expect(val1).not.toBeNull();
      expect(val2).not.toBeNull();
      expect(val1!.length).toBe(36);
      expect(val1).not.toBe(val2);
    });

    it("generates an integer timestamp for $timestamp", () => {
      const val = evaluateDynamicVariable("$timestamp");
      expect(val).not.toBeNull();
      const num = parseInt(val!, 10);
      expect(num).toBeGreaterThan(1_700_000_000);
    });

    it("generates a valid ISO-8601 timestamp for $isoTimestamp", () => {
      const val = evaluateDynamicVariable("$isoTimestamp");
      expect(val).not.toBeNull();
      const date = new Date(val!);
      expect(!isNaN(date.getTime())).toBe(true);
    });

    it("generates a bounded random integer for $randomInt", () => {
      const val = evaluateDynamicVariable("$randomInt");
      expect(val).not.toBeNull();
      const num = parseInt(val!, 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(1000);
    });

    it("generates a realistic test email for $randomEmail", () => {
      const val = evaluateDynamicVariable("$randomEmail");
      expect(val).not.toBeNull();
      expect(val!).toMatch(/^test\.user\d+@example\.com$/);
    });

    it("returns null for unknown dynamic variable", () => {
      expect(evaluateDynamicVariable("$unknownVar")).toBeNull();
      expect(evaluateDynamicVariable("customVar")).toBeNull();
    });
  });

  describe("substituteClientVariables", () => {
    it("substitutes dynamic variables in string", () => {
      const template = "https://api.example.com/events?id={{$uuid}}&t={{$timestamp}}";
      const result = substituteClientVariables(template);

      expect(result).not.toContain("{{$uuid}}");
      expect(result).not.toContain("{{$timestamp}}");
      expect(result).toMatch(/https:\/\/api\.example\.com\/events\?id=[a-f0-9-]{36}&t=\d+/);
    });

    it("prefers environment variable over dynamic generator when matching key exists", () => {
      const template = "User ID: {{$uuid}}";
      const envVars = { $uuid: "fixed-user-override" };
      const result = substituteClientVariables(template, envVars);

      expect(result).toBe("User ID: fixed-user-override");
    });

    it("leaves unmatched unknown variables intact", () => {
      const template = "Hello {{unmatchedVar}}";
      const result = substituteClientVariables(template);

      expect(result).toBe("Hello {{unmatchedVar}}");
    });
  });

  describe("createVariableCompletionSource", () => {
    it("returns null when context does not match {{", () => {
      const source = createVariableCompletionSource(() => ({}));
      const mockContext: any = {
        matchBefore: () => null,
      };

      expect(source(mockContext)).toBeNull();
    });

    it("returns dynamic and environment completions when typing {{", () => {
      const source = createVariableCompletionSource(() => ({
        baseUrl: "https://api.example.com",
        apiKey: "secret-123",
      }));

      const mockContext: any = {
        matchBefore: (regex: RegExp) => {
          if (regex.test("{{")) return { from: 0, to: 2, text: "{{" };
          return null;
        },
      };

      const result = source(mockContext);
      expect(result).not.toBeNull();
      const completion = result as CompletionResult;
      expect(completion.options.length).toBeGreaterThanOrEqual(DYNAMIC_VARIABLES.length + 2);

      const labels = completion.options.map((o) => o.label);
      expect(labels).toContain("{{$uuid}}");
      expect(labels).toContain("{{$timestamp}}");
      expect(labels).toContain("{{baseUrl}}");
      expect(labels).toContain("{{apiKey}}");
    });

    it("masks secret variable values in autocomplete suggestions", () => {
      const source = createVariableCompletionSource(
        () => ({
          publicVar: "normal-value",
          secretToken: "super-secret-password",
        }),
        () => new Set(["secretToken"])
      );

      const mockContext: any = {
        matchBefore: (regex: RegExp) => {
          if (regex.test("{{")) return { from: 0, to: 2, text: "{{" };
          return null;
        },
      };

      const result = source(mockContext);
      expect(result).not.toBeNull();
      const completion = result as CompletionResult;

      const secretOption = completion.options.find((o) => o.label === "{{secretToken}}");
      expect(secretOption).toBeDefined();
      expect(secretOption?.detail).toBe("•••••••• (secret)");
      expect(secretOption?.info).toContain("Secret Variable: {{secretToken}} (value masked)");
      expect(secretOption?.info).not.toContain("super-secret-password");

      const publicOption = completion.options.find((o) => o.label === "{{publicVar}}");
      expect(publicOption).toBeDefined();
      expect(publicOption?.detail).toBe("normal-value");
      expect(publicOption?.info).toContain("normal-value");
    });
  });
});
