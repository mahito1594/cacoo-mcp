# @mahito1594/cacoo-mcp

README: [日本語](./README.md) | English

An unofficial [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for [Cacoo](https://cacoo.com). Exposes read-only tools so AI coding agents (Claude Code, Cursor, etc.) can reference Cacoo diagram images and metadata directly.

## Setup

### 1. Get a Cacoo API key

Generate an API key from [your Cacoo account settings](https://cacoo.com/app/space/settings/integrations/developer-tools).

### 2. Configure your MCP client

**Claude Code**: Run the following command

```bash
claude mcp add --env CACOO_API_KEY=your-api-key-here cacoo-mcp -- npx -y @mahito1594/cacoo-mcp
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` or `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cacoo-mcp": {
      "command": "npx",
      "args": ["-y", "@mahito1594/cacoo-mcp"],
      "env": {
        "CACOO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "cacoo-mcp": {
      "command": "npx",
      "args": ["-y", "@mahito1594/cacoo-mcp"],
      "env": {
        "CACOO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Environment variables

| Variable                 | Required | Description                                                                      |
| ------------------------ | -------- | -------------------------------------------------------------------------------- |
| `CACOO_API_KEY`          | Yes      | Cacoo API key                                                                    |
| `CACOO_ORGANIZATION_KEY` | No       | Default organization key. If omitted, use `list_organizations` first to find it. |

## Tools

| Tool                 | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `list_organizations` | List Cacoo organizations available to the configured API key |
| `list_diagrams`      | List diagrams, optionally filtered by keyword or folder      |
| `get_diagram_sheets` | Get the list of sheets in a diagram (sheet IDs and names)    |
| `get_diagram_image`  | Fetch PNG image(s) of a diagram as base64-encoded content    |

### Typical workflow

```
list_organizations()                    # if CACOO_ORGANIZATION_KEY is not set
list_diagrams(keyword?)                 # find diagramId; note sheetCount
  if sheetCount > 3:
    get_diagram_sheets(diagramId)       # get sheetId values
get_diagram_image(diagramId, sheetId?)  # fetch image(s)
```

When `sheetId` is omitted, `get_diagram_image` fetches all sheets in parallel.

## Development

Node.js >= 22 and [pnpm](https://pnpm.io/) >= 10 are required.
Install them by using [mise](https://mise.jdx.dev/).

```bash
pnpm install
pnpm build       # compile TypeScript → dist/index.mjs
pnpm test        # run tests
pnpm typecheck   # type-check without emitting
pnpm lint        # run oxlint
```

## Acknowledgements

This project includes the following third-party Agent Skills.

- [contextual-commits](https://github.com/berserkdisruptors/contextual-commits) by Berserk Disruptors — MIT License

## License

[MIT](./LICENSE)
