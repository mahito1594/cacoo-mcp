import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CacooApi, OrganizationListResponse } from "../cacoo-api";
import { fromApiError, okResult, textContent } from "./shared";

/**
 * Formats organizations as flat text that both humans and LLMs can scan quickly.
 */
const formatOrganizations = (response: OrganizationListResponse): string => {
  if (response.result.length === 0) {
    return `No organizations found. count: ${response.count}`;
  }

  const lines = response.result.flatMap((organization) => [
    `id: ${organization.id}`,
    `key: ${organization.key}`,
    `name: ${organization.name}`,
    "",
  ]);

  return [`count: ${response.count}`, "", lines.slice(0, -1).join("\n")].join("\n");
};

/**
 * Registers the organization discovery tool used when `CACOO_ORGANIZATION_KEY` is not configured.
 *
 * Many diagram endpoints expect an organization key, so the server needs an explicit discovery step.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/organizations/
 */
export const registerListOrganizationsTool = (server: McpServer, api: CacooApi): void => {
  server.registerTool(
    "list_organizations",
    {
      description:
        "List Cacoo organizations available to the configured API key. Use this when CACOO_ORGANIZATION_KEY is not set and you need an organization key.",
    },
    async () => {
      const organizations = await api.getOrganizations();
      if (!organizations.ok) {
        return fromApiError(organizations.error);
      }

      return okResult(textContent(formatOrganizations(organizations.value)));
    },
  );
};
