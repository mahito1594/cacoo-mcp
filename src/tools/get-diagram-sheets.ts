import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CacooApi, DiagramDetail } from "../cacoo-api.js";
import { fromApiError, okResult, textContent } from "./shared.js";

/**
 * The sheet list only exists on the diagram detail endpoint, so this tool takes only `diagramId`
 * and resolves the detail request internally.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/diagram/
 */
const inputSchema = {
  diagramId: z.string().min(1).describe("Cacoo diagram ID"),
} as const;

/**
 * Formats only the information needed to choose a target sheet.
 */
const formatSheets = (diagram: DiagramDetail): string => {
  if (diagram.sheets.length === 0) {
    return `No sheets found for diagramId: ${diagram.diagramId}`;
  }

  return [
    `diagramId: ${diagram.diagramId}`,
    `title: ${diagram.title}`,
    "",
    diagram.sheets
      .map((sheet) =>
        [
          `sheetId: ${sheet.uid}`,
          `name: ${sheet.name}`,
          `width: ${sheet.width ?? "unknown"}`,
          `height: ${sheet.height ?? "unknown"}`,
        ].join("\n"),
      )
      .join("\n\n"),
  ].join("\n");
};

/**
 * Registers the sheet discovery tool used before fetching images for large diagrams.
 */
export const registerGetDiagramSheetsTool = (server: McpServer, api: CacooApi): void => {
  server.registerTool(
    "get_diagram_sheets",
    {
      description:
        "Get the list of sheets in a Cacoo diagram, including sheet IDs and names. Use this before get_diagram_image when a diagram has many sheets (sheetCount > 3).",
      inputSchema,
    },
    async ({ diagramId }) => {
      const diagram = await api.getDiagram(diagramId);
      if (!diagram.ok) {
        return fromApiError(diagram.error);
      }

      return okResult(textContent(formatSheets(diagram.value)));
    },
  );
};
