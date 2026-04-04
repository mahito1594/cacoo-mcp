# @mahito1594/cacoo-mcp

[English](./README_en.md)

[Cacoo](https://cacoo.com) の非公式 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) サーバーです。Claude Code や Cursor などの AI コーディングエージェントが Cacoo の図の画像やメタデータを直接参照できるよう、読み取り専用のツールを提供します。

## セットアップ

### 1. Cacoo API キーを取得する

[Cacoo のアカウント設定](https://cacoo.com/app/space/settings/integrations/developer-tools)から API キーを生成してください。

### 2. MCP クライアントを設定する

**Claude Code** (`~/.claude/claude.json` または `.claude/claude.json`):

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

### 環境変数

| 変数名                   | 必須 | 説明                                                                                         |
| ------------------------ | ---- | -------------------------------------------------------------------------------------------- |
| `CACOO_API_KEY`          | 必須 | Cacoo API キー                                                                               |
| `CACOO_ORGANIZATION_KEY` | 任意 | デフォルトの組織キー。省略した場合は先に `list_organizations` を呼び出して取得してください。 |

## ツール

| ツール名             | 説明                                                       |
| -------------------- | ---------------------------------------------------------- |
| `list_organizations` | 設定された API キーで利用できる Cacoo 組織の一覧を取得する |
| `list_diagrams`      | 図の一覧を取得する（キーワードやフォルダでの絞り込みも可） |
| `get_diagram_sheets` | 図に含まれるシートの一覧（シート ID と名前）を取得する     |
| `get_diagram_image`  | 図の PNG 画像を Base64 エンコードで取得する                |

### 典型的な使用フロー

```
list_organizations()                    # CACOO_ORGANIZATION_KEY が未設定の場合
list_diagrams(keyword?)                 # diagramId を特定し sheetCount を確認
  if sheetCount > 3:
    get_diagram_sheets(diagramId)       # sheetId を取得
get_diagram_image(diagramId, sheetId?)  # 画像を取得
```

`sheetId` を省略した場合、`get_diagram_image` はすべてのシートを並列で取得します。

## 開発

Node.js >= 22 および [pnpm](https://pnpm.io/) >= 10 が必要です。
[mise](https://mise.jdx.dev/) を用いてインストールしてください。

```bash
pnpm install
pnpm build       # TypeScript をコンパイル → dist/index.mjs
pnpm test        # テストを実行
pnpm typecheck   # 型チェック（出力なし）
pnpm lint        # oxlint を実行
```

## 謝辞

このプロジェクトは以下のサードパーティソフトウェアを使用しています。

- [contextual-commits](https://github.com/berserkdisruptors/contextual-commits) by Berserk Disruptors — MIT License

## ライセンス

[MIT](./LICENSE)
