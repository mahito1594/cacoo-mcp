import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { CacooApi, DiagramDetail } from "../cacoo-api";
import type { Result } from "../types";
import { fromApiError, imageContent, okResult, textContent } from "./shared";

/**
 * Input shape spanning both the Cacoo image API and the diagram detail API.
 *
 * When `sheetId` is omitted, a direct image request is not enough because the server first needs
 * the sheet list from the detail endpoint.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/image/
 * - https://developer.nulab.com/docs/cacoo/api/1/diagram/
 */
const inputSchema = {
  diagramId: z.string().min(1).describe("Cacoo diagram ID"),
  sheetId: z.string().min(1).optional().describe("Specific sheet ID"),
  width: z.number().int().positive().optional().describe("PNG width in pixels"),
  height: z.number().int().positive().optional().describe("PNG height in pixels"),
} as const;

/**
 * Returns alternating sheet labels and images when all sheets are requested.
 *
 * Sending images alone makes it easy to lose which sheet each image belongs to, so this uses
 * MCP content ordering to preserve that context.
 */
const getAllSheetImages = async (
  api: CacooApi,
  diagram: DiagramDetail,
  width: number | undefined,
  height: number | undefined,
): Promise<Result<CallToolResult, { message: string }>> => {
  const images = await Promise.all(
    diagram.sheets.map(async (sheet) => {
      const image = await api.getDiagramImage({
        diagramId: diagram.diagramId,
        sheetId: sheet.uid,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      });
      return { image, sheet };
    }),
  );

  const failed = images.find((entry) => !entry.image.ok);
  if (failed && !failed.image.ok) {
    return {
      ok: false,
      error: {
        message: failed.image.error.message,
      },
    };
  }

  return {
    ok: true,
    value: okResult(
      ...images.flatMap((entry) =>
        entry.image.ok
          ? [
              textContent(`sheet: ${entry.sheet.name} (${entry.sheet.uid})`),
              imageContent(entry.image.value),
            ]
          : [],
      ),
    ),
  };
};

/**
 * Switches between single-sheet retrieval and all-sheet retrieval based on `sheetId`.
 *
 * Keeping the branching here lets the tool registration stay a thin adapter.
 */
const getDiagramImageResult = async (
  api: CacooApi,
  params: Readonly<{
    diagramId: string;
    sheetId?: string;
    width?: number;
    height?: number;
  }>,
): Promise<CallToolResult> => {
  if (params.sheetId) {
    const image = await api.getDiagramImage({
      diagramId: params.diagramId,
      sheetId: params.sheetId,
      ...(params.width !== undefined ? { width: params.width } : {}),
      ...(params.height !== undefined ? { height: params.height } : {}),
    });
    if (!image.ok) {
      return fromApiError(image.error);
    }

    return okResult(imageContent(image.value));
  }

  const diagram = await api.getDiagram(params.diagramId);
  if (!diagram.ok) {
    return fromApiError(diagram.error);
  }

  if (diagram.value.sheets.length === 0) {
    return {
      content: [
        textContent(
          `No sheets found for diagramId: ${params.diagramId}. Unable to fetch all-sheet images.`,
        ),
      ],
      isError: true,
    };
  }

  const allSheetImages = await getAllSheetImages(api, diagram.value, params.width, params.height);
  return allSheetImages.ok
    ? allSheetImages.value
    : { content: [textContent(allSheetImages.error.message)], isError: true };
};

/**
 * Registers the image tool that passes diagram PNG data directly to the LLM.
 *
 * It also bridges the Cacoo PNG response format into MCP ImageContent.
 */
export const registerGetDiagramImageTool = (server: McpServer, api: CacooApi): void => {
  server.registerTool(
    "get_diagram_image",
    {
      description:
        "Fetch PNG image(s) of a Cacoo diagram. If sheetId is omitted, fetches ALL sheets. When the diagram has many sheets (sheetCount > 3), use get_diagram_sheets first to identify the target sheet.",
      inputSchema,
    },
    async (input) =>
      getDiagramImageResult(api, {
        diagramId: input.diagramId,
        ...(input.sheetId ? { sheetId: input.sheetId } : {}),
        ...(input.width !== undefined ? { width: input.width } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
      }),
  );
};
