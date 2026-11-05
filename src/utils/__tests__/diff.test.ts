import { describe, it, expect } from "vitest";
import {
  normalizeForDiff,
  computeUnifiedDiff,
  computeSplitDiff,
  compareHeaders,
  diffResponses,
} from "../diff";
import { BoltResponse } from "../../store/requestStore";

describe("diff utility", () => {
  describe("normalizeForDiff", () => {
    it("sorts JSON keys recursively to eliminate cosmetic ordering diffs", () => {
      const json1 = '{\n  "b": 2,\n  "a": 1\n}';
      const json2 = '{\n  "a": 1,\n  "b": 2\n}';

      const norm1 = normalizeForDiff(json1);
      const norm2 = normalizeForDiff(json2);

      expect(norm1).toBe(norm2);
      expect(norm1).toContain('"a": 1');
    });

    it("handles non-JSON raw strings gracefully without throwing", () => {
      const raw = "<html>\r\n<body>Hello</body>\r\n</html>";
      const normalized = normalizeForDiff(raw);
      expect(normalized).toBe("<html>\n<body>Hello</body>\n</html>");
    });

    it("handles empty or blank content", () => {
      expect(normalizeForDiff("")).toBe("");
      expect(normalizeForDiff("   ")).toBe("");
    });
  });

  describe("computeUnifiedDiff", () => {
    it("returns all unchanged lines when texts are identical", () => {
      const text = "line 1\nline 2\nline 3";
      const diff = computeUnifiedDiff(text, text);

      expect(diff.length).toBe(3);
      expect(diff.every((d) => d.type === "unchanged")).toBe(true);
      expect(diff[0].oldLineNumber).toBe(1);
      expect(diff[0].newLineNumber).toBe(1);
    });

    it("identifies additions and deletions accurately", () => {
      const oldText = "apple\nbanana\ncherry";
      const newText = "apple\nblueberry\ncherry\ndate";

      const diff = computeUnifiedDiff(oldText, newText);

      const removed = diff.filter((d) => d.type === "removed");
      const added = diff.filter((d) => d.type === "added");
      const unchanged = diff.filter((d) => d.type === "unchanged");

      expect(removed.map((r) => r.text)).toEqual(["banana"]);
      expect(added.map((a) => a.text)).toEqual(["blueberry", "date"]);
      expect(unchanged.map((u) => u.text)).toEqual(["apple", "cherry"]);
    });
  });

  describe("computeSplitDiff", () => {
    it("aligns modifications side-by-side in left and right columns", () => {
      const oldText = "item1\noldValue\nitem3";
      const newText = "item1\nnewValue\nitem3";

      const unified = computeUnifiedDiff(oldText, newText);
      const split = computeSplitDiff(unified);

      expect(split.length).toBe(3);
      expect(split[0].left?.text).toBe("item1");
      expect(split[0].right?.text).toBe("item1");

      // Modified row aligned
      expect(split[1].left?.text).toBe("oldValue");
      expect(split[1].left?.type).toBe("removed");
      expect(split[1].right?.text).toBe("newValue");
      expect(split[1].right?.type).toBe("added");

      expect(split[2].left?.text).toBe("item3");
      expect(split[2].right?.text).toBe("item3");
    });
  });

  describe("compareHeaders", () => {
    it("accurately identifies added, removed, modified, and unchanged headers", () => {
      const oldHeaders = [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "X-Old-Token", value: "old-val", enabled: true },
        { key: "Cache-Control", value: "no-cache", enabled: true },
      ];

      const newHeaders = [
        { key: "Content-Type", value: "text/plain", enabled: true }, // modified
        { key: "Cache-Control", value: "no-cache", enabled: true }, // unchanged
        { key: "X-New-Token", value: "new-val", enabled: true }, // added
      ];

      const diffs = compareHeaders(oldHeaders, newHeaders);

      const modified = diffs.find((d) => d.key.toLowerCase() === "content-type");
      expect(modified?.type).toBe("modified");
      expect(modified?.oldValue).toBe("application/json");
      expect(modified?.newValue).toBe("text/plain");

      const removed = diffs.find((d) => d.key.toLowerCase() === "x-old-token");
      expect(removed?.type).toBe("removed");

      const added = diffs.find((d) => d.key.toLowerCase() === "x-new-token");
      expect(added?.type).toBe("added");

      const unchanged = diffs.find((d) => d.key.toLowerCase() === "cache-control");
      expect(unchanged?.type).toBe("unchanged");
    });
  });

  describe("diffResponses", () => {
    it("flags isIdentical as true when status, headers, and body match exactly", () => {
      const res1: BoltResponse = {
        status: 200,
        status_text: "OK",
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        body: '{"status":"ok"}',
        time_ms: 120,
        size_bytes: 15,
      };

      const res2: BoltResponse = {
        status: 200,
        status_text: "OK",
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        body: '{\n  "status": "ok"\n}', // Different whitespace, same normalized JSON
        time_ms: 95,
        size_bytes: 19,
      };

      const diff = diffResponses(res1, res2);
      expect(diff.isIdentical).toBe(true);
      expect(diff.summary.statusDiff).toBeUndefined();
      expect(diff.summary.sizeDiff.deltaBytes).toBe(4);
      expect(diff.summary.timeDiff?.deltaMs).toBe(-25);
    });

    it("captures status regressions and payload differences", () => {
      const baseline: BoltResponse = {
        status: 200,
        status_text: "OK",
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        body: '{"id":1,"status":"active"}',
        time_ms: 50,
        size_bytes: 26,
      };

      const current: BoltResponse = {
        status: 500,
        status_text: "Internal Server Error",
        headers: [{ key: "Content-Type", value: "text/plain", enabled: true }],
        body: "Database connection failed",
        time_ms: 150,
        size_bytes: 26,
      };

      const diff = diffResponses(baseline, current);
      expect(diff.isIdentical).toBe(false);
      expect(diff.summary.statusDiff).toBeDefined();
      expect(diff.summary.statusDiff?.oldStatus).toBe(200);
      expect(diff.summary.statusDiff?.newStatus).toBe(500);
      expect(diff.summary.additions).toBeGreaterThan(0);
      expect(diff.summary.deletions).toBeGreaterThan(0);
    });
  });
});

