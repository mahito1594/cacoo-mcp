#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { version } from "../package.json";
import { createCacooApi } from "./cacoo-api";
import { registerGetDiagramImageTool } from "./tools/get-diagram-image";
import { registerGetDiagramSheetsTool } from "./tools/get-diagram-sheets";
import { registerListDiagramsTool } from "./tools/list-diagrams";
import { registerListOrganizationsTool } from "./tools/list-organizations";

const envSchema = z.object({
  CACOO_API_KEY: z.string().min(1, "CACOO_API_KEY is required"),
  CACOO_ORGANIZATION_KEY: z.string().min(1).optional(),
});

/**
 * Application composition root.
 *
 * Environment resolution, API client creation, and tool registration live here so the rest of the
 * modules can stay focused on plain function dependencies.
 */
const createServer = (): McpServer => {
  const env = envSchema.parse(process.env);
  const api = createCacooApi({
    apiKey: env.CACOO_API_KEY,
    ...(env.CACOO_ORGANIZATION_KEY ? { organizationKey: env.CACOO_ORGANIZATION_KEY } : {}),
  });

  const server = new McpServer({
    name: "@mahito1594/cacoo-mcp",
    version,
  });

  registerListOrganizationsTool(server, api);
  registerListDiagramsTool(server, api);
  registerGetDiagramSheetsTool(server, api);
  registerGetDiagramImageTool(server, api);

  return server;
};

/**
 * Starts the MCP server over the stdio transport.
 *
 * stdout is reserved for JSON-RPC traffic, so startup avoids normal logging and only connects.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error occurred:", error);
  process.exit(1);
});
