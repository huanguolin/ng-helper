# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ng-helper is a VS Code extension providing language service support for AngularJS 1.x projects. It's a TypeScript monorepo managed with Yarn Workspaces.

## Common Commands

```bash
# Full CI check (tsc + lint + test)
yarn ci

# Individual checks
yarn tsc          # Type-check all packages in parallel (tsc --noEmit)
yarn lint         # ESLint across all .ts files
yarn test         # Unit tests for typescript-plugin, shared, ng-parser

# Package-specific
cd packages/ng-helper-vscode && yarn compile       # Build extension (tsc + lint + esbuild)
cd packages/ng-helper-vscode && yarn test:e2e      # E2E tests (requires compile:e2e first)
cd packages/ng-helper-vscode && yarn package       # Package .vsix

# Run a single Jest test file
cd packages/<package> && npx jest <test-file-pattern>
```

Build tool: **esbuild** for bundling, **tsc** for type-checking only (`noEmit: true`).

## Architecture

```
┌─────────────────────────────┐     RPC over WebSocket       ┌──────────────────────────┐
│  ng-helper-vscode           │ ◄──────────────────────────► │  typescript-plugin       │
│  (VS Code extension host)   │   { id, method, params }     │  (runs inside tsserver)  │
│                             │   { requestId, result }      │                          │
│  Registers all Providers:   │                              │  Express HTTP server     │
│  completion, hover, def,    │                              │  ngHelperTsService       │
│  diagnostic, signatureHelp, │                              │  TypeScript TypeChecker  │
│  codeLens, semantic, link   │                              │  NgCache                 │
└─────────────────────────────┘                              └──────────────────────────┘
```

### Packages

| Package | Purpose |
|---------|---------|
| `ng-helper-vscode` | VS Code extension entry point. Registers language providers, communicates with typescript-plugin via WebSocket RPC. Bundles into two separate outputs: extension main (`esbuild-ext.js`) and RPC service process (`esbuild-rpc.js`). |
| `typescript-plugin` | TypeScript Server Plugin injected into tsserver. Provides type-aware completions, hover, definitions. Exposes Express-based RPC server. Core: `ngHelperTsService` singleton manages multi-project state, `RpcRouter` routes requests, `NgCache` caches results. |
| `ng-parser` | Hand-written lexer (`scanner/`) + parser (`parser/`) for AngularJS expressions. Supports filter expressions (pipes), ng-repeat, ng-controller syntax. Grammar spec in `grammar.md`. |
| `shared` | RPC protocol types, plugin configuration interfaces, HTML parsing utilities (parse5), cursor position analysis, NG expression diagnostics, user config schema (zod). |
| `ng-lint-cli` | Standalone CLI that scans AngularJS HTML files and reports expression errors. |

### Key Communication Pattern

- Extension side: `RpcApi` class wraps all RPC method calls, `rpcQueryControl` manages request queue and timeouts.
- Plugin side: Each RPC request includes a `fileName` field used for routing to the correct TypeScript project context.
- All RPC messages are JSON-serialized over WebSocket.

### Activation

The extension activates when a workspace contains `.vscode/ng-helper.json`. This config file is required for the extension to function.

## Testing

- **Unit tests**: Jest with `@babel/preset-typescript`. Located in `packages/*/tests/*.spec.ts`.
- **E2E tests**: `@vscode/test-electron` + Mocha + Chai. Launches real VS Code (pinned to v1.93.1) with fixture projects. Located in `packages/ng-helper-vscode/tests/e2e/`.
- **Snapshot updates**: `UPDATE_SNAPSHOT=1 yarn test:e2e:u`
- CI runs unit tests only (E2E requires a graphical environment).

## Code Conventions

- Prettier: singleQuote, trailingComma, printWidth 120, tabWidth 4
- TypeScript strict mode, target ES2022, module commonjs
- `import type` required for imports from `'typescript'` (enforced by ESLint)
- Import ordering: builtin > external > parent > sibling (alphabetical)
- Naming: PascalCase for types/interfaces, camelCase for methods
- Comments are primarily in Chinese
