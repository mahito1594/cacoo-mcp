import { describe, expect, it } from "vitest";
import { err, ok } from "./types";

describe("ok", () => {
  it("returns a success result with the given value", () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("works with object values", () => {
    const value = { name: "test" };
    const result = ok(value);
    expect(result).toEqual({ ok: true, value: { name: "test" } });
  });
});

describe("err", () => {
  it("returns a failure result with the given error", () => {
    const result = err("something went wrong");
    expect(result).toEqual({ ok: false, error: "something went wrong" });
  });

  it("works with object errors", () => {
    const error = { kind: "network" as const, message: "timeout" };
    const result = err(error);
    expect(result).toEqual({ ok: false, error: { kind: "network", message: "timeout" } });
  });
});
