import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCacooApi } from "./cacoo-api";

const TEST_API_KEY = "test-api-key-secret";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const organizationListResponse = {
  result: [{ id: 1, key: "orgKey", name: "My Org" }],
  count: 1,
};

const diagramListResponse = {
  result: [
    {
      diagramId: "diag-1",
      title: "My Diagram",
      sheetCount: 2,
      updated: "2024-01-01",
      url: "https://cacoo.com/diagrams/diag-1",
    },
  ],
  count: 1,
};

const diagramDetailResponse = {
  diagramId: "diag-1",
  title: "My Diagram",
  sheets: [
    { uid: "sheet-1", name: "Page 1", width: 800, height: 600 },
    { uid: "sheet-2", name: "Page 2", width: 1024, height: 768 },
  ],
};

describe("createCacooApi — getOrganizations", () => {
  it("returns parsed organizations on success", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(organizationListResponse));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toEqual([{ id: 1, key: "orgKey", name: "My Org" }]);
      expect(result.value.count).toBe(1);
    }
  });

  it("calls the correct endpoint URL", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(organizationListResponse));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });
    await api.getOrganizations();

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.pathname).toBe("/api/v1/organizations.json");
    expect(calledUrl.searchParams.get("apiKey")).toBe(TEST_API_KEY);
  });

  it("returns http error on non-ok response", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("http");
      expect(result.error.message).toContain("401");
    }
  });

  it("returns network error when fetch rejects", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network");
      expect(result.error.message).toContain("fetch failed");
    }
  });

  it("returns network error with timeout message on TimeoutError", async () => {
    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(timeoutError);
    const api = createCacooApi({ apiKey: TEST_API_KEY, timeoutMs: 5000, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network");
      expect(result.error.message).toContain("timed out after 5000ms");
    }
  });

  it("returns decode error when response body does not match schema", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ unexpected: true }));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("decode");
    }
  });

  it("returns decode error when response is not valid JSON", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<!doctype html><html></html>", { status: 200 }));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("decode");
      expect(result.error.message).not.toContain(TEST_API_KEY);
    }
  });

  it("does not expose apiKey in error messages", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Forbidden", { status: 403, statusText: "Forbidden" }),
    );
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getOrganizations();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain(TEST_API_KEY);
    }
  });
});

describe("createCacooApi — getDiagrams", () => {
  it("returns parsed diagrams on success", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(diagramListResponse));
    const api = createCacooApi({ apiKey: TEST_API_KEY, organizationKey: "orgKey", fetchFn });

    const result = await api.getDiagrams({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result[0]!.diagramId).toBe("diag-1");
    }
  });

  it("includes all query params in the request URL", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(diagramListResponse));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    await api.getDiagrams({
      organizationKey: "orgKey",
      keyword: "test",
      folderId: 42,
      offset: 10,
      limit: 25,
    });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.searchParams.get("organizationKey")).toBe("orgKey");
    expect(calledUrl.searchParams.get("keyword")).toBe("test");
    expect(calledUrl.searchParams.get("folderId")).toBe("42");
    expect(calledUrl.searchParams.get("offset")).toBe("10");
    expect(calledUrl.searchParams.get("limit")).toBe("25");
  });

  it("uses organizationKey from params over config", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(diagramListResponse));
    const api = createCacooApi({
      apiKey: TEST_API_KEY,
      organizationKey: "configKey",
      fetchFn,
    });

    await api.getDiagrams({ organizationKey: "paramKey" });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.searchParams.get("organizationKey")).toBe("paramKey");
  });

  it("falls back to config organizationKey when not in params", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(diagramListResponse));
    const api = createCacooApi({
      apiKey: TEST_API_KEY,
      organizationKey: "configKey",
      fetchFn,
    });

    await api.getDiagrams({});

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.searchParams.get("organizationKey")).toBe("configKey");
  });

  it("returns config error when no organizationKey is available", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagrams({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config");
      expect(result.error.message).toContain("organizationKey");
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("createCacooApi — getDiagram", () => {
  it("returns parsed diagram detail on success", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(diagramDetailResponse));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagram("diag-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.diagramId).toBe("diag-1");
      expect(result.value.sheets).toHaveLength(2);
      expect(result.value.sheets[0]!.uid).toBe("sheet-1");
    }
  });

  it("defaults sheets to empty array when missing from response", async () => {
    const { sheets: _, ...withoutSheets } = diagramDetailResponse;
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(withoutSheets));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagram("diag-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sheets).toEqual([]);
    }
  });

  it("URL-encodes the diagramId in the path", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(diagramDetailResponse));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    await api.getDiagram("a/b c");

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.pathname).toContain(encodeURIComponent("a/b c"));
  });

  it("returns http error on non-ok response", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagram("missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("http");
    }
  });
});

describe("createCacooApi — getDiagramImage", () => {
  const pngBuffer: ArrayBuffer = new Uint8Array([0x50, 0x4e, 0x47]).buffer; // "PNG"

  let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(pngBuffer, { status: 200, headers: { "Content-Type": "image/png" } }),
    );
  });

  it("returns ArrayBuffer on success", async () => {
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagramImage({ diagramId: "diag-1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeInstanceOf(ArrayBuffer);
    }
  });

  it("uses path without sheetId when sheetId is not provided", async () => {
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });
    await api.getDiagramImage({ diagramId: "diag-1" });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.pathname).toBe("/api/v1/diagrams/diag-1.png");
  });

  it("includes sheetId in path when provided", async () => {
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });
    await api.getDiagramImage({ diagramId: "diag-1", sheetId: "sheet-1" });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.pathname).toBe("/api/v1/diagrams/diag-1-sheet-1.png");
  });

  it("URL-encodes diagramId and sheetId in path", async () => {
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });
    await api.getDiagramImage({ diagramId: "a/b", sheetId: "s/1" });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.pathname).toContain(encodeURIComponent("a/b"));
    expect(calledUrl.pathname).toContain(encodeURIComponent("s/1"));
  });

  it("includes width and height as query params when provided", async () => {
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });
    await api.getDiagramImage({ diagramId: "diag-1", width: 800, height: 600 });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.searchParams.get("width")).toBe("800");
    expect(calledUrl.searchParams.get("height")).toBe("600");
  });

  it("does not include width/height query params when not provided", async () => {
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });
    await api.getDiagramImage({ diagramId: "diag-1" });

    const calledUrl = fetchFn.mock.calls[0]![0] as URL;
    expect(calledUrl.searchParams.has("width")).toBe(false);
    expect(calledUrl.searchParams.has("height")).toBe(false);
  });

  it("returns http error on non-ok response", async () => {
    fetchFn.mockResolvedValue(new Response("Forbidden", { status: 403, statusText: "Forbidden" }));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagramImage({ diagramId: "diag-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("http");
    }
  });

  it("returns decode error when arrayBuffer() throws", async () => {
    const badResponse = new Response(null, { status: 200 });
    vi.spyOn(badResponse, "arrayBuffer").mockRejectedValue(new Error("stream error"));
    fetchFn.mockResolvedValue(badResponse);
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagramImage({ diagramId: "diag-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("decode");
      expect(result.error.message).toContain("stream error");
      expect(result.error.message).not.toContain(TEST_API_KEY);
    }
  });

  it("does not expose apiKey in error messages", async () => {
    fetchFn.mockResolvedValue(new Response("Error", { status: 500, statusText: "Error" }));
    const api = createCacooApi({ apiKey: TEST_API_KEY, fetchFn });

    const result = await api.getDiagramImage({ diagramId: "diag-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain(TEST_API_KEY);
    }
  });
});
