import { z } from "zod";
import { err, ok, type Result } from "./types.js";

const cacooBaseUrl = "https://cacoo.com/api/v1";
const defaultTimeoutMs = 30_000;

/**
 * Schema for the subset of the Organizations API response that this server actually needs.
 *
 * The server only needs `id`, `key`, and `name` to let callers discover an organization.
 * Unknown fields are intentionally stripped so parsed API payloads stay small and predictable.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/organizations/
 */
const organizationSchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
});

/**
 * Subset of the owner object returned by both diagram list and diagram detail endpoints.
 *
 * Owner data is secondary for the MCP tools, so this schema keeps only fields that may be useful
 * and discards the rest of the remote payload.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/diagrams/
 * - https://developer.nulab.com/docs/cacoo/api/1/diagram/
 */
const ownerSchema = z.object({
  name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

/**
 * Minimal schema for entries in the Diagram API `sheets` array.
 *
 * `uid` is required to fetch a sheet image, and `name` plus dimensions are enough to help
 * an agent choose the right sheet before requesting the image.
 * Extra sheet properties are stripped because the tools do not need them.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/diagram/
 */
const sheetSchema = z.object({
  uid: z.string(),
  name: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

/**
 * Shared fields between the diagram list and diagram detail endpoints.
 *
 * Keeping their overlap in one base schema localizes the actual difference between the endpoints
 * to the presence of `sheets` in the detail response.
 * Unknown fields are stripped during parsing by default in Zod object schemas.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/diagrams/
 * - https://developer.nulab.com/docs/cacoo/api/1/diagram/
 */
const diagramSchema = z.object({
  diagramId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageUrlForApi: z.string().nullable().optional(),
  security: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  owner: ownerSchema.optional(),
  editing: z.boolean().nullable().optional(),
  own: z.boolean().nullable().optional(),
  shared: z.boolean().nullable().optional(),
  folderId: z.number().nullable().optional(),
  folderName: z.string().nullable().optional(),
  sheetCount: z.number().nullable().optional(),
  created: z.string().nullable().optional(),
  updated: z.string().nullable().optional(),
});

/**
 * The diagram list endpoint returns data in `{ result, count }` form.
 *
 * Reference:
 * https://developer.nulab.com/docs/cacoo/api/1/diagrams/
 */
const diagramsResponseSchema = z.object({
  result: z.array(diagramSchema),
  count: z.number(),
});

/**
 * The organizations endpoint also returns data in `{ result, count }` form.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/organizations/
 */
const organizationsResponseSchema = z.object({
  result: z.array(organizationSchema),
  count: z.number(),
});

/**
 * Schema for the diagram detail endpoint.
 *
 * Defaulting `sheets` to an empty array keeps the tool layer simpler by avoiding extra
 * null or undefined branching.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/api/1/diagram/
 */
const diagramDetailSchema = diagramSchema.extend({
  sheets: z.array(sheetSchema).default([]),
});

export type Organization = z.infer<typeof organizationSchema>;
export type Sheet = z.infer<typeof sheetSchema>;
export type Diagram = z.infer<typeof diagramSchema>;
export type DiagramDetail = z.infer<typeof diagramDetailSchema>;
export type DiagramListResponse = z.infer<typeof diagramsResponseSchema>;
export type OrganizationListResponse = z.infer<typeof organizationsResponseSchema>;

export type ApiError = Readonly<{
  kind: "config" | "network" | "http" | "decode";
  message: string;
  cause?: unknown;
}>;

export type GetDiagramsParams = Readonly<{
  organizationKey?: string;
  keyword?: string;
  folderId?: number;
  offset?: number;
  limit?: number;
  type?: string;
  sortOn?: string;
  sortType?: string;
}>;

export type GetDiagramImageParams = Readonly<{
  diagramId: string;
  sheetId?: string;
  width?: number;
  height?: number;
}>;

export type CacooApi = Readonly<{
  getOrganizations: () => Promise<Result<OrganizationListResponse, ApiError>>;
  getDiagrams: (params: GetDiagramsParams) => Promise<Result<DiagramListResponse, ApiError>>;
  getDiagram: (diagramId: string) => Promise<Result<DiagramDetail, ApiError>>;
  getDiagramImage: (params: GetDiagramImageParams) => Promise<Result<ArrayBuffer, ApiError>>;
}>;

type CacooApiConfig = Readonly<{
  apiKey: string;
  organizationKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}>;

type RequestOptions = Readonly<{
  path: string;
  query?: Readonly<Record<string, string | number | undefined>>;
}>;

/**
 * Cacoo authentication uses an `apiKey` query parameter, so raw request URLs are sensitive.
 *
 * This helper preserves enough URL context for diagnostics while reliably masking the secret.
 *
 * Reference:
 * - https://developer.nulab.com/docs/cacoo/auth/
 */
const maskUrl = (url: URL): string => {
  const masked = new URL(url);
  if (masked.searchParams.has("apiKey")) {
    masked.searchParams.set("apiKey", "***");
  }
  return masked.toString();
};

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const resolveOrganizationKey = (
  organizationKey: string | undefined,
  defaultOrganizationKey: string | undefined,
): Result<string, ApiError> => {
  const resolved = organizationKey ?? defaultOrganizationKey;
  if (resolved) {
    return ok(resolved);
  }

  return err({
    kind: "config",
    message:
      "organizationKey is required. Set CACOO_ORGANIZATION_KEY or call list_organizations to discover the organization key first.",
  });
};

const createUrl = (
  apiKey: string,
  path: string,
  query: Readonly<Record<string, string | number | undefined>> = {},
): URL => {
  const url = new URL(`${cacooBaseUrl}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set("apiKey", apiKey);
  return url;
};

const parseJson = async <T>(
  response: Response,
  schema: z.ZodType<T>,
  requestUrl: URL,
): Promise<Result<T, ApiError>> => {
  try {
    const json = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err({
        kind: "decode",
        message: `Failed to decode Cacoo API response for ${maskUrl(requestUrl)}: ${parsed.error.message}`,
      });
    }
    return ok(parsed.data);
  } catch (error) {
    return err({
      kind: "decode",
      message: `Failed to parse JSON response from ${maskUrl(requestUrl)}: ${describeError(error)}`,
      cause: error,
    });
  }
};

const toHttpError = async (response: Response, requestUrl: URL): Promise<ApiError> => {
  const body = await response.text().catch(() => "");
  const suffix = body.trim().length > 0 ? ` Response: ${body.trim()}` : "";
  return {
    kind: "http",
    message: `Cacoo API request failed with ${response.status} ${response.statusText} for ${maskUrl(requestUrl)}.${suffix}`,
  };
};

/**
 * Builds an immutable set of functions for calling the Cacoo API.
 *
 * This uses a record of functions instead of a mutable class so the tool layer depends on
 * explicit inputs and outputs rather than shared mutable state.
 *
 * Returning `Result` values instead of throwing also makes it straightforward for MCP tool
 * handlers to map failures into consistent `isError: true` responses.
 */
export const createCacooApi = (config: CacooApiConfig): CacooApi => {
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? defaultTimeoutMs;

  /**
   * Shared implementation for all GET requests.
   *
   * Authentication, timeout handling, and HTTP error conversion live here so each endpoint
   * function can focus on its own input and response schema.
   */
  const request = async (options: RequestOptions): Promise<Result<Response, ApiError>> => {
    const url = createUrl(config.apiKey, options.path, options.query);
    const signal = AbortSignal.timeout(timeoutMs);

    try {
      const response = await fetchFn(url, { method: "GET", signal });
      if (!response.ok) {
        return err(await toHttpError(response, url));
      }
      return ok(response);
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? `Cacoo API request timed out after ${timeoutMs}ms for ${maskUrl(url)}`
          : `Cacoo API request failed for ${maskUrl(url)}: ${describeError(error)}`;

      return err({
        kind: "network",
        message,
        cause: error,
      });
    }
  };

  const getOrganizations = async (): Promise<Result<OrganizationListResponse, ApiError>> => {
    const response = await request({ path: "/organizations.json" });
    if (!response.ok) {
      return response;
    }

    return parseJson(
      response.value,
      organizationsResponseSchema,
      createUrl(config.apiKey, "/organizations.json"),
    );
  };

  const getDiagrams = async (
    params: GetDiagramsParams,
  ): Promise<Result<DiagramListResponse, ApiError>> => {
    const organizationKey = resolveOrganizationKey(params.organizationKey, config.organizationKey);
    if (!organizationKey.ok) {
      return organizationKey;
    }

    const query = {
      organizationKey: organizationKey.value,
      keyword: params.keyword,
      folderId: params.folderId,
      offset: params.offset,
      limit: params.limit,
      type: params.type,
      sortOn: params.sortOn,
      sortType: params.sortType,
    } satisfies Readonly<Record<string, string | number | undefined>>;

    const response = await request({ path: "/diagrams.json", query });
    if (!response.ok) {
      return response;
    }

    return parseJson(
      response.value,
      diagramsResponseSchema,
      createUrl(config.apiKey, "/diagrams.json", query),
    );
  };

  const getDiagram = async (diagramId: string): Promise<Result<DiagramDetail, ApiError>> => {
    const path = `/diagrams/${encodeURIComponent(diagramId)}.json`;
    const response = await request({ path });
    if (!response.ok) {
      return response;
    }

    return parseJson(response.value, diagramDetailSchema, createUrl(config.apiKey, path));
  };

  const getDiagramImage = async (
    params: GetDiagramImageParams,
  ): Promise<Result<ArrayBuffer, ApiError>> => {
    const encodedDiagramId = encodeURIComponent(params.diagramId);
    const encodedSheetId = params.sheetId ? `-${encodeURIComponent(params.sheetId)}` : "";
    const path = `/diagrams/${encodedDiagramId}${encodedSheetId}.png`;
    const query = {
      width: params.width,
      height: params.height,
    } satisfies Readonly<Record<string, string | number | undefined>>;
    const response = await request({ path, query });
    if (!response.ok) {
      return response;
    }

    try {
      return ok(await response.value.arrayBuffer());
    } catch (error) {
      return err({
        kind: "decode",
        message: `Failed to read PNG response from ${maskUrl(createUrl(config.apiKey, path, query))}: ${describeError(error)}`,
        cause: error,
      });
    }
  };

  return {
    getOrganizations,
    getDiagrams,
    getDiagram,
    getDiagramImage,
  };
};
