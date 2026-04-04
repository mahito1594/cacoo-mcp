import { describe, expect, it } from "vitest";
import type { ApiError } from "../cacoo-api.js";
import { errorResult, fromApiError, imageContent, okResult, textContent } from "./shared.js";

describe("textContent", () => {
  it("returns a TextContent with type text", () => {
    expect(textContent("hello")).toEqual({ type: "text", text: "hello" });
  });
});

describe("imageContent", () => {
  it("returns an ImageContent with base64-encoded data and image/png mimeType", () => {
    const bytes = new TextEncoder().encode("PNG");
    const buffer = bytes.buffer;
    const result = imageContent(buffer);
    expect(result.type).toBe("image");
    expect(result.mimeType).toBe("image/png");
    expect(result.data).toBe(Buffer.from(buffer).toString("base64"));
  });

  it("encodes empty buffer as empty string", () => {
    const result = imageContent(new ArrayBuffer(0));
    expect(result.data).toBe("");
  });
});

describe("okResult", () => {
  it("wraps content array without isError", () => {
    const result = okResult(textContent("ok"));
    expect(result.content).toEqual([{ type: "text", text: "ok" }]);
    expect(result.isError).toBeUndefined();
  });

  it("accepts multiple content items", () => {
    const result = okResult(textContent("a"), textContent("b"));
    expect(result.content).toHaveLength(2);
  });
});

describe("errorResult", () => {
  it("wraps message as text content with isError: true", () => {
    const result = errorResult("something failed");
    expect(result.content).toEqual([{ type: "text", text: "something failed" }]);
    expect(result.isError).toBe(true);
  });
});

describe("fromApiError", () => {
  it("delegates to errorResult with error.message", () => {
    const error: ApiError = { kind: "network", message: "connection refused" };
    const result = fromApiError(error);
    expect(result.content).toEqual([{ type: "text", text: "connection refused" }]);
    expect(result.isError).toBe(true);
  });

  it("works for all error kinds", () => {
    const kinds = ["config", "network", "http", "decode"] as const;
    for (const kind of kinds) {
      const result = fromApiError({ kind, message: `${kind} error` });
      expect(result.isError).toBe(true);
    }
  });
});
