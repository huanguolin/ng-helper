# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ng-helper is an Angular.js (1.x) Language Service extension for VS Code, providing comprehensive language support including auto-completion, hover documentation, go-to-definition, and diagnostics for Angular.js applications.

## Architecture

This is a yarn workspace monorepo with 5 packages:

- **ng-helper-vscode**: The main VS Code extension
- **typescript-plugin**: TypeScript server plugin that provides language service features
- **shared**: Common utilities and types shared between packages
- **ng-parser**: Angular.js expression parser and AST utilities
- **ng-lint-cli**: Command-line linting tool

The extension operates through two main components:
1. A VS Code extension (`ng-helper-vscode`) that provides UI commands and activation
2. A TypeScript server plugin (`typescript-plugin`) that integrates with VS Code's TypeScript language service

## Development Commands

### Build and Test
```bash
# Full CI pipeline (TypeScript compilation, linting, and tests)
yarn ci

# Build all packages
yarn tsc

# Lint all packages
yarn lint

# Run all tests
yarn test

# Run tests for specific packages
yarn test:plugin
yarn test:shared
yarn test:ng-parser
```

### Package-specific Commands
```bash
# VS Code extension development
cd packages/ng-helper-vscode
yarn compile              # Build extension for production
yarn compile:e2e          # Build for E2E testing
yarn watch:esbuild:ext    # Watch mode for extension
yarn watch:esbuild:rpc    # Watch mode for RPC server
yarn test:e2e             # Run E2E tests
yarn test:e2e:u           # Update E2E test snapshots

# TypeScript plugin development
cd packages/typescript-plugin
yarn compile              # Build plugin for production
yarn test                 # Run unit tests
yarn test:watch           # Run tests in watch mode

# Shared library development
cd packages/shared
yarn test                 # Run unit tests
yarn test:watch           # Run tests in watch mode

# Angular parser development
cd packages/ng-parser
yarn test                 # Run unit tests
yarn test:coverage        # Run tests with coverage
```

### Extension Packaging
```bash
cd packages/ng-helper-vscode
yarn package              # Create .vsix file for distribution
```

## Key Technical Details

### Activation
The extension only activates when a `.vscode/ng-helper.json` file exists in the workspace root. This file can be empty but is required as an activation flag.

### TypeScript Integration
The TypeScript plugin (`typescript-plugin`) is registered as a TypeScript server plugin and provides:
- Custom completion providers for Angular.js directives, components, and filters
- Hover information for Angular.js constructs
- Go-to-definition for custom directives/components
- Diagnostic validation for dependency injection

### Architecture Communication
- The VS Code extension communicates with the TypeScript plugin via WebSocket (RPC)
- The TypeScript plugin extends the native TypeScript language service
- Shared utilities in the `shared` package handle Angular.js parsing and analysis

### Configuration
Configuration is handled through `.vscode/ng-helper.json` with options for:
- `componentStyleFileExt`: Style file extension (default: `css`)
- `componentScriptFileExt`: Script file extension (`js` or `ts`, default: `js`)
- `componentTemplateFileSuffix`: Template file suffix pattern (default: `component.html`)
- `injectionCheckMode`: Dependency injection validation mode
- `ngProjects`: Manual project configuration for complex setups

### Testing Strategy
- Unit tests using Jest for individual packages
- E2E tests using VS Code's test framework in `packages/ng-helper-vscode/tests`
- Snapshot testing for E2E scenarios

### Build System
- Uses esbuild for production builds
- TypeScript for type checking (no emit)
- ESLint with TypeScript rules for code quality
- Yarn workspaces for dependency management

## Development Workflow

1. Make changes to relevant packages
2. Run `yarn tsc` to verify TypeScript compilation
3. Run `yarn lint` to check code style
4. Run package-specific tests
5. For extension changes, test with `yarn test:e2e` in the vscode package
6. Use `yarn ci` to run the full validation pipeline before commits