import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import type { CacooApi } from "../cacoo-api";
import { err, ok } from "../types";
import { registerGetDiagramSheetsTool } from "./get-diagram-sheets";

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

describe("registerGetDiagramSheetsTool", () => {
  it("registers with name get_diagram_sheets", () => {
    const { mockServer } = captureHandler();
    registerGetDiagramSheetsTool(mockServer, createMockApi());

    expect(
      (mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]![0],
    ).toBe("get_diagram_sheets");
  });

  it("returns formatted sheet list on success", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getDiagram: vi.fn().mockResolvedValue(
        ok({
          diagramId: "diag-1",
          title: "My Diagram",
          sheets: [
            { uid: "sheet-1", name: "Page 1", width: 800, height: 600 },
            { uid: "sheet-2", name: "Page 2", width: 1024, height: 768 },
          ],
        }),
      ),
    });
    registerGetDiagramSheetsTool(mockServer, api);

    const result = await getHandler()({ diagramId: "diag-1" });

    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("sheetId: sheet-1");
    expect(text).toContain("name: Page 1");
    expect(text).toContain("width: 800");
    expect(text).toContain("height: 600");
    expect(text).toContain("sheetId: sheet-2");
  });

  it("returns 'No sheets found' when diagram has no sheets", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getDiagram: vi.fn().mockResolvedValue(
        ok({ diagramId: "diag-1", title: "My Diagram", sheets: [] }),
      ),
    });
    registerGetDiagramSheetsTool(mockServer, api);

    const result = await getHandler()({ diagramId: "diag-1" });

    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("No sheets found");
    expect(text).toContain("diag-1");
  });

  it("returns isError: true on API failure", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getDiagram: vi
        .fn()
        .mockResolvedValue(err({ kind: "http" as const, message: "404 Not Found" })),
    });
    registerGetDiagramSheetsTool(mockServer, api);

    const result = await getHandler()({ diagramId: "missing" });

    expect(result).toMatchObject({ isError: true });
    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("404 Not Found");
  });

  it("passes diagramId to api.getDiagram", async () => {
    const { mockServer, getHandler } = captureHandler();
    const getDiagram = vi
      .fn()
      .mockResolvedValue(ok({ diagramId: "diag-42", title: "T", sheets: [] }));
    const api = createMockApi({ getDiagram });
    registerGetDiagramSheetsTool(mockServer, api);

    await getHandler()({ diagramId: "diag-42" });

    expect(getDiagram).toHaveBeenCalledWith("diag-42");
  });
});
