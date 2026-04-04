import type { CallToolResult, ImageContent, TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { ApiError } from "../cacoo-api.js";

/**
 * Helpers that keep MCP content block construction consistent across tools.
 *
 * Without a shared layer, small differences in error handling and content array construction
 * tend to spread across handlers.
 */
export const textContent = (text: string): TextContent => ({
  type: "text",
  text,
});

/**
 * Converts PNG bytes returned by the Cacoo image API into MCP ImageContent.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/image/
 */
export const imageContent = (data: ArrayBuffer): ImageContent => ({
  type: "image",
  data: Buffer.from(data).toString("base64"),
  mimeType: "image/png",
});

export const okResult = (...content: CallToolResult["content"]): CallToolResult => ({
  content,
});

export const errorResult = (message: string): CallToolResult => ({
  content: [textContent(message)],
  isError: true,
});

/**
 * Maps internal API errors into MCP tool errors.
 *
 * Returning readable text instead of rethrowing lets the caller inspect the failure reason directly.
 */
export const fromApiError = (error: ApiError): CallToolResult => errorResult(error.message);
