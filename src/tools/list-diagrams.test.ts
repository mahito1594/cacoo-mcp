import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import type { CacooApi } from "../cacoo-api";
import { err, ok } from "../types";
import { registerListDiagramsTool } from "./list-diagrams";

const createMockApi = (overrides?: Partial<CacooApi>): CacooApi => ({
  getOrganizations: vi.fn(),
  getDiagrams: vi.fn(),
  getDiagram: vi.fn(),
  getDiagramImage: vi.fn(),
  ...overrides,
});

const captureHandler = () => {
  let handler: ((input: unknown) => unknown) | undefined;
  const mockServer = {
    registerTool: vi.fn((_name: string, _config: unknown, cb: (input: unknown) => unknown) => {
      handler = cb;
    }),
  } as unknown as McpServer;
  return { mockServer, getHandler: () => handler! };
};

const diagramListResponse = {
  result: [
    {
      diagramId: "diag-1",
      title: "My Diagram",
      sheetCount: 3,
      updated: "2024-06-01",
      url: "https://cacoo.com/diagrams/diag-1",
    },
  ],
  count: 1,
};

describe("registerListDiagramsTool", () => {
  it("registers with name list_diagrams", () => {
    const { mockServer } = captureHandler();
    registerListDiagramsTool(mockServer, createMockApi());

    expect((mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      "list_diagrams",
    );
  });

  it("returns formatted diagram list on success", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getDiagrams: vi.fn().mockResolvedValue(ok(diagramListResponse)),
    });
    registerListDiagramsTool(mockServer, api);

    const result = await getHandler()({ offset: 0, limit: 50 });

    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("diagramId: diag-1");
    expect(text).toContain("title: My Diagram");
    expect(text).toContain("sheetCount: 3");
    expect(text).toContain("updated: 2024-06-01");
    expect(text).toContain("url: https://cacoo.com/diagrams/diag-1");
    expect(text).toContain("count: 1");
  });

  it("returns 'No diagrams found' when result is empty", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getDiagrams: vi.fn().mockResolvedValue(ok({ result: [], count: 0 })),
    });
    registerListDiagramsTool(mockServer, api);

    const result = await getHandler()({ offset: 0, limit: 50 });

    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("No diagrams found");
  });

  it("passes all input parameters to api.getDiagrams", async () => {
    const { mockServer, getHandler } = captureHandler();
    const getDiagrams = vi.fn().mockResolvedValue(ok(diagramListResponse));
    const api = createMockApi({ getDiagrams });
    registerListDiagramsTool(mockServer, api);

    await getHandler()({
      organizationKey: "orgKey",
      keyword: "arch",
      folderId: 7,
      offset: 10,
      limit: 20,
    });

    expect(getDiagrams).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationKey: "orgKey",
        keyword: "arch",
        folderId: 7,
        offset: 10,
        limit: 20,
      }),
    );
  });

  it("does not pass undefined optional params to api.getDiagrams", async () => {
    const { mockServer, getHandler } = captureHandler();
    const getDiagrams = vi.fn().mockResolvedValue(ok(diagramListResponse));
    const api = createMockApi({ getDiagrams });
    registerListDiagramsTool(mockServer, api);

    await getHandler()({ offset: 0, limit: 50 });

    const calledWith = getDiagrams.mock.calls[0]![0] as Record<string, unknown>;
    expect(calledWith).not.toHaveProperty("organizationKey");
    expect(calledWith).not.toHaveProperty("keyword");
    expect(calledWith).not.toHaveProperty("folderId");
  });

  it("returns isError: true on API failure", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getDiagrams: vi
        .fn()
        .mockResolvedValue(err({ kind: "config" as const, message: "organizationKey required" })),
    });
    registerListDiagramsTool(mockServer, api);

    const result = await getHandler()({ offset: 0, limit: 50 });

    expect(result).toMatchObject({ isError: true });
    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("organizationKey required");
  });
});
