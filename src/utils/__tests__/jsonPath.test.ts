import { describe, it, expect } from "vitest";
import { evaluateJsonPath } from "../jsonPath";

describe("evaluateJsonPath", () => {
  const sampleData = {
    store: {
      name: "Boltt Bookshop",
      books: [
        { id: 1, title: "Rust in Action", price: 39.99, available: true },
        { id: 2, title: "TypeScript Deep Dive", price: 29.99, available: false },
        { id: 3, title: "Building APIs with Tauri", price: 49.99, available: true },
      ],
      owner: {
        name: "Alice",
        email: "alice@example.com",
      },
    },
  };

  it("returns full object formatted when path is empty", () => {
    const res = evaluateJsonPath(sampleData, "");
    expect(res.success).toBe(true);
    expect(res.result).toEqual(sampleData);
    expect(res.count).toBe(1);
  });

  it("extracts a nested scalar property with $. prefix", () => {
    const res = evaluateJsonPath(sampleData, "$.store.name");
    expect(res.success).toBe(true);
    expect(res.result).toEqual(["Boltt Bookshop"]);
    expect(res.count).toBe(1);
  });

  it("extracts without $ prefix automatically", () => {
    const res = evaluateJsonPath(sampleData, "store.owner.email");
    expect(res.success).toBe(true);
    expect(res.result).toEqual(["alice@example.com"]);
    expect(res.count).toBe(1);
  });

  it("evaluates array wildcard queries (e.g. $.store.books[*].title)", () => {
    const res = evaluateJsonPath(sampleData, "$.store.books[*].title");
    expect(res.success).toBe(true);
    expect(res.result).toEqual([
      "Rust in Action",
      "TypeScript Deep Dive",
      "Building APIs with Tauri",
    ]);
    expect(res.count).toBe(3);
  });

  it("evaluates array index queries (e.g. store.books[0])", () => {
    const res = evaluateJsonPath(sampleData, "store.books[0]");
    expect(res.success).toBe(true);
    expect(res.result).toEqual([
      { id: 1, title: "Rust in Action", price: 39.99, available: true },
    ]);
    expect(res.count).toBe(1);
  });

  it("evaluates filter expressions (e.g. $.store.books[?(@.price > 35)])", () => {
    const res = evaluateJsonPath(sampleData, "$.store.books[?(@.price > 35)]");
    expect(res.success).toBe(true);
    expect(Array.isArray(res.result)).toBe(true);
    const matches = res.result as Array<{ id: number; price: number }>;
    expect(matches.length).toBe(2);
    expect(matches.map((m) => m.id)).toEqual([1, 3]);
  });

  it("handles non-existent paths gracefully returning empty array", () => {
    const res = evaluateJsonPath(sampleData, "$.store.nonExistentKey");
    expect(res.success).toBe(true);
    expect(res.result).toEqual([]);
    expect(res.count).toBe(0);
  });

  it("handles malformed JSONPath syntax gracefully without throwing", () => {
    const res = evaluateJsonPath(sampleData, "$..[?(@..");
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});

