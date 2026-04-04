# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

An unofficial MCP Server for [Cacoo](https://cacoo.com) that exposes read-only tools for fetching diagram images and metadata. Designed to run as a stdio server via `npx`, enabling AI coding agents (Claude Code, Cursor) to reference Cacoo diagrams directly.

## Commands

```bash
pnpm build          # Compile TypeScript → dist/index.mjs via tsdown
pnpm dev            # Watch mode build
pnpm typecheck      # Type-check without emitting (tsc --noEmit)
pnpm lint           # Run oxlint
pnpm lint:fix       # Run oxlint --fix
pnpm format         # Check formatting with oxfmt
pnpm format:fix     # Fix formatting with oxfmt
```

There are no tests yet. Build output lands in `dist/`.

## Architecture

### Composition root (`src/index.ts`)

- Validates environment variables (`CACOO_API_KEY` required, `CACOO_ORGANIZATION_KEY` optional) using Zod
- Instantiates `CacooApi` and registers all four MCP tools onto `McpServer`
- Connects via `StdioServerTransport`; **stdout is reserved for JSON-RPC** — never use `console.log`

### API client (`src/cacoo-api.ts`)

- Exports `createCacooApi(config)` which returns an immutable `CacooApi` record of async functions
- All functions return `Result<T, ApiError>` (never throw) so tool handlers can map failures to `isError: true` responses
- Authentication is via `apiKey` query parameter; the `maskUrl` helper strips it from error messages
- `ApiError.kind` is one of `"config" | "network" | "http" | "decode"`

### Tools (`src/tools/`)

Each file exports a single `register*Tool(server, api)` function. Shared helpers live in `src/tools/shared.ts`:

- `okResult(...content)` / `errorResult(message)` — build `CallToolResult`
- `fromApiError(error)` — converts `ApiError` → `CallToolResult` with `isError: true`
- `imageContent(arrayBuffer)` — encodes PNG bytes as base64 `ImageContent`

### Tool workflow (expected agent usage)

```
list_diagrams(keyword?)          → find diagramId, note sheetCount
  if sheetCount > 3:
    get_diagram_sheets(diagramId) → get sheetId values
get_diagram_image(diagramId, sheetId?, width?, height?)
```

When `sheetId` is omitted from `get_diagram_image`, the tool fetches the diagram detail first, then fetches all sheets in parallel and returns interleaved `TextContent` (sheet name) + `ImageContent`.

## Key constraints

- `package.json` has `"private": true` — remove before publishing to npm
- Node >= 22 required (`AbortSignal.timeout` is used for request timeouts)
- Zod v4 is in use (`zod@^4`); schemas use `.safeParse()` not `.parse()` in the API client
- `tsconfig.json` uses `"module": "preserve"` with bundler resolution; `.js` extensions in **internal** relative imports are not required — `moduleResolution: bundler` allows extensionless imports, and tsdown inlines internal modules at bundle time. External package subpath imports (e.g. `@modelcontextprotocol/sdk/server/mcp.js`) must keep `.js` when the package's `exports` wildcard map requires it
- `console.log` is forbidden in all source files (stdout is JSON-RPC)
- `organizationKey` resolution order: tool argument → `CACOO_ORGANIZATION_KEY` env var → `config` error directing agent to call `list_organizations` first
