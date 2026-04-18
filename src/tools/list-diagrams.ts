import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CacooApi, DiagramListResponse } from "../cacoo-api";
import { fromApiError, okResult, textContent } from "./shared";

/**
 * Exposes only the smallest useful input surface for diagram discovery.
 *
 * The Cacoo API supports more parameters such as type and sort controls, but this tool focuses
 * on the common agent workflow of finding the right diagram first.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/diagrams/
 */
const inputSchema = {
  organizationKey: z
    .string()
    .optional()
    .describe("Cacoo organization key from list_organizations, for example `hEkx29Hj9h`"),
  keyword: z.string().optional().describe("Keyword to search diagram titles and descriptions"),
  folderId: z.number().int().optional().describe("Folder ID to filter diagrams"),
  offset: z.number().int().nonnegative().default(0).describe("Pagination offset"),
  limit: z.number().int().positive().max(100).default(50).describe("Number of diagrams to fetch"),
} as const;

const formatDiagram = (diagram: DiagramListResponse["result"][number]): string =>
  [
    `diagramId: ${diagram.diagramId}`,
    `title: ${diagram.title}`,
    `sheetCount: ${diagram.sheetCount ?? "unknown"}`,
    `created: ${diagram.created ?? "unknown"}`,
    `updated: ${diagram.updated ?? "unknown"}`,
    `url: ${diagram.url ?? "unknown"}`,
  ].join("\n");

const formatDiagrams = (response: DiagramListResponse): string => {
  if (response.result.length === 0) {
    return `No diagrams found. count: ${response.count}`;
  }

  return [`count: ${response.count}`, "", response.result.map(formatDiagram).join("\n\n")].join(
    "\n",
  );
};

/**
 * Registers the diagram listing tool used to discover a `diagramId`.
 *
 * Because this sits in front of sheet and image retrieval, the output stays focused on fields
 * that help identify and choose a diagram.
 */
export const registerListDiagramsTool = (server: McpServer, api: CacooApi): void => {
  server.registerTool(
    "list_diagrams",
    {
      description:
        "List Cacoo diagrams. Use this to find a diagram ID by title or keyword before fetching sheets or images. organizationKey should be the organization key from list_organizations, for example `hEkx29Hj9h`.",
      inputSchema,
    },
    async (input) => {
      const diagrams = await api.getDiagrams({
        ...(input.organizationKey ? { organizationKey: input.organizationKey } : {}),
        ...(input.keyword ? { keyword: input.keyword } : {}),
        ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
        offset: input.offset,
        limit: input.limit,
      });
      if (!diagrams.ok) {
        return fromApiError(diagrams.error);
      }

      return okResult(textContent(formatDiagrams(diagrams.value)));
    },
  );
};
