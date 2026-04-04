import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import type { CacooApi } from "../cacoo-api.js";
import { err, ok } from "../types.js";
import { registerGetDiagramImageTool } from "./get-diagram-image.js";

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

const fakePng: ArrayBuffer = new Uint8Array([0x50, 0x4e, 0x47]).buffer; // "PNG"

const diagramDetailWithSheets = {
  diagramId: "diag-1",
  title: "My Diagram",
  sheets: [
    { uid: "sheet-1", name: "Page 1", width: 800, height: 600 },
    { uid: "sheet-2", name: "Page 2", width: 1024, height: 768 },
  ],
};

describe("registerGetDiagramImageTool", () => {
  it("registers with name get_diagram_image", () => {
    const { mockServer } = captureHandler();
    registerGetDiagramImageTool(mockServer, createMockApi());

    expect(
      (mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]![0],
    ).toBe("get_diagram_image");
  });

  describe("with sheetId provided", () => {
    it("returns image content on success", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagramImage: vi.fn().mockResolvedValue(ok(fakePng)),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1", sheetId: "sheet-1" });

      expect(result).toMatchObject({
        content: [{ type: "image", mimeType: "image/png" }],
      });
      expect(result).not.toMatchObject({ isError: true });
    });

    it("passes diagramId and sheetId to api.getDiagramImage", async () => {
      const { mockServer, getHandler } = captureHandler();
      const getDiagramImage = vi.fn().mockResolvedValue(ok(fakePng));
      const api = createMockApi({ getDiagramImage });
      registerGetDiagramImageTool(mockServer, api);

      await getHandler()({ diagramId: "diag-1", sheetId: "sheet-1" });

      expect(getDiagramImage).toHaveBeenCalledWith(
        expect.objectContaining({ diagramId: "diag-1", sheetId: "sheet-1" }),
      );
    });

    it("passes width and height when provided", async () => {
      const { mockServer, getHandler } = captureHandler();
      const getDiagramImage = vi.fn().mockResolvedValue(ok(fakePng));
      const api = createMockApi({ getDiagramImage });
      registerGetDiagramImageTool(mockServer, api);

      await getHandler()({ diagramId: "diag-1", sheetId: "sheet-1", width: 800, height: 600 });

      expect(getDiagramImage).toHaveBeenCalledWith(
        expect.objectContaining({ width: 800, height: 600 }),
      );
    });

    it("does not pass width/height when not provided", async () => {
      const { mockServer, getHandler } = captureHandler();
      const getDiagramImage = vi.fn().mockResolvedValue(ok(fakePng));
      const api = createMockApi({ getDiagramImage });
      registerGetDiagramImageTool(mockServer, api);

      await getHandler()({ diagramId: "diag-1", sheetId: "sheet-1" });

      const calledWith = getDiagramImage.mock.calls[0]![0] as Record<string, unknown>;
      expect(calledWith).not.toHaveProperty("width");
      expect(calledWith).not.toHaveProperty("height");
    });

    it("returns isError: true on API failure", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagramImage: vi
          .fn()
          .mockResolvedValue(err({ kind: "http" as const, message: "403 Forbidden" })),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1", sheetId: "sheet-1" });

      expect(result).toMatchObject({ isError: true });
    });
  });

  describe("without sheetId (all-sheets path)", () => {
    it("returns interleaved text+image content for each sheet", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagram: vi.fn().mockResolvedValue(ok(diagramDetailWithSheets)),
        getDiagramImage: vi.fn().mockResolvedValue(ok(fakePng)),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1" });

      const content = (result as { content: Array<{ type: string }> }).content;
      expect(content).toHaveLength(4); // 2 sheets × (text + image)
      expect(content[0]).toMatchObject({ type: "text" });
      expect(content[1]).toMatchObject({ type: "image" });
      expect(content[2]).toMatchObject({ type: "text" });
      expect(content[3]).toMatchObject({ type: "image" });
    });

    it("includes sheet name and uid in text labels", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagram: vi.fn().mockResolvedValue(ok(diagramDetailWithSheets)),
        getDiagramImage: vi.fn().mockResolvedValue(ok(fakePng)),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1" });

      const content = (result as { content: Array<{ type: string; text?: string }> }).content;
      expect(content[0]!.text).toContain("Page 1");
      expect(content[0]!.text).toContain("sheet-1");
      expect(content[2]!.text).toContain("Page 2");
      expect(content[2]!.text).toContain("sheet-2");
    });

    it("fetches each sheet image with the correct sheetId", async () => {
      const { mockServer, getHandler } = captureHandler();
      const getDiagramImage = vi.fn().mockResolvedValue(ok(fakePng));
      const api = createMockApi({
        getDiagram: vi.fn().mockResolvedValue(ok(diagramDetailWithSheets)),
        getDiagramImage,
      });
      registerGetDiagramImageTool(mockServer, api);

      await getHandler()({ diagramId: "diag-1" });

      expect(getDiagramImage).toHaveBeenCalledTimes(2);
      expect(getDiagramImage).toHaveBeenCalledWith(
        expect.objectContaining({ diagramId: "diag-1", sheetId: "sheet-1" }),
      );
      expect(getDiagramImage).toHaveBeenCalledWith(
        expect.objectContaining({ diagramId: "diag-1", sheetId: "sheet-2" }),
      );
    });

    it("returns isError: true when diagram has no sheets", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagram: vi
          .fn()
          .mockResolvedValue(ok({ diagramId: "diag-1", title: "T", sheets: [] })),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1" });

      expect(result).toMatchObject({ isError: true });
      const text = (result as { content: [{ text: string }] }).content[0]!.text;
      expect(text).toContain("No sheets found");
    });

    it("returns isError: true when any sheet image fetch fails", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagram: vi.fn().mockResolvedValue(ok(diagramDetailWithSheets)),
        getDiagramImage: vi
          .fn()
          .mockResolvedValueOnce(ok(fakePng))
          .mockResolvedValueOnce(err({ kind: "http" as const, message: "sheet fetch failed" })),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1" });

      expect(result).toMatchObject({ isError: true });
      const text = (result as { content: [{ text: string }] }).content[0]!.text;
      expect(text).toContain("sheet fetch failed");
    });

    it("returns isError: true when getDiagram fails", async () => {
      const { mockServer, getHandler } = captureHandler();
      const api = createMockApi({
        getDiagram: vi
          .fn()
          .mockResolvedValue(err({ kind: "network" as const, message: "network error" })),
      });
      registerGetDiagramImageTool(mockServer, api);

      const result = await getHandler()({ diagramId: "diag-1" });

      expect(result).toMatchObject({ isError: true });
    });
  });
});
