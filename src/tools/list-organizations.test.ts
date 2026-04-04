import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import type { CacooApi } from "../cacoo-api";
import { err, ok } from "../types";
import { registerListOrganizationsTool } from "./list-organizations";

const createMockApi = (overrides?: Partial<CacooApi>): CacooApi => ({
  getOrganizations: vi.fn(),
  getDiagrams: vi.fn(),
  getDiagram: vi.fn(),
  getDiagramImage: vi.fn(),
  ...overrides,
});

const captureHandler = () => {
  let handler: ((...args: unknown[]) => unknown) | undefined;
  const mockServer = {
    registerTool: vi.fn((_name: string, _config: unknown, cb: (...args: unknown[]) => unknown) => {
      handler = cb;
    }),
  } as unknown as McpServer;
  return { mockServer, getHandler: () => handler! };
};

describe("registerListOrganizationsTool", () => {
  it("registers with name list_organizations", () => {
    const { mockServer } = captureHandler();
    const api = createMockApi();
    registerListOrganizationsTool(mockServer, api);

    expect((mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      "list_organizations",
    );
  });

  it("returns formatted organizations on success", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getOrganizations: vi.fn().mockResolvedValue(
        ok({
          result: [{ id: 1, key: "orgKey", name: "My Org" }],
          count: 1,
        }),
      ),
    });
    registerListOrganizationsTool(mockServer, api);

    const result = await getHandler()();

    expect(result).toMatchObject({ content: [{ type: "text" }] });
    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("id: 1");
    expect(text).toContain("key: orgKey");
    expect(text).toContain("name: My Org");
    expect(text).toContain("count: 1");
  });

  it("returns 'No organizations found' when result is empty", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getOrganizations: vi.fn().mockResolvedValue(ok({ result: [], count: 0 })),
    });
    registerListOrganizationsTool(mockServer, api);

    const result = await getHandler()();

    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("No organizations found");
  });

  it("returns isError: true on API failure", async () => {
    const { mockServer, getHandler } = captureHandler();
    const api = createMockApi({
      getOrganizations: vi
        .fn()
        .mockResolvedValue(err({ kind: "network" as const, message: "connection refused" })),
    });
    registerListOrganizationsTool(mockServer, api);

    const result = await getHandler()();

    expect(result).toMatchObject({ isError: true });
    const text = (result as { content: [{ text: string }] }).content[0]!.text;
    expect(text).toContain("connection refused");
  });
});
