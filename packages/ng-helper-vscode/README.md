# ng-helper - Angular.js Language Service

[![lint & tsc & unit-test](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml/badge.svg)](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml)

> [中文文档](https://github.com/huanguolin/ng-helper/blob/main/packages/ng-helper-vscode/README.zh_cn.md)

![demo](https://raw.githubusercontent.com/huanguolin/ng-helper/main/resources/demo.gif)

## Features

- [x] `ng-*` directive auto-completion ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/builtin-directives-demo.gif))
- [x] Custom directives: tag/attribute auto-completion, hover documentation, go to definition ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/directives-demo.gif))
- [x] Custom components: tag/attribute auto-completion, hover documentation, go to definition ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/components-demo.gif))
- [x] Custom filters: auto-completion, hover documentation, go to definition ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/filters-demo.gif))
- [x] HTML syntax highlighting with inline HTML support ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/inline-html-demo.gif))
- [x] ✨🆕 Data binding (TypeScript required): auto-completion, type hints on hover, go to definition ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/data-binding-demo.gif))
- [ ] Diagnostics
  - [ ] Angular.js expression diagnostics in HTML
  - [x] Dependency injection validation ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/injection-validate-demo.gif))
    - [x] TypeScript code
    - [x] JavaScript code

> Additional utilities:
- [x] Navigate from 'templateUrl' to the corresponding HTML file ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/template-url-jump-demo.gif))
- [x] ✨🆕 Navigate from controller name to its implementation file ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/controller-jump-demo.gif))
- [x] ✨🆕 Navigate to service implementation by its name ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/service-jump-demo.gif))
- [x] Click to search for 'directive'/'component' usage locations ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/search-component-use-demo.gif))
- [x] Create components via context menu ([see demo](https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/create-component-demo.gif))

## Requirements

* VS Code 1.80.0+
* TypeScript 3.5.3+ (Some features require this, see above) 

## Installation

1. Install the extension
2. Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace (***This file is a plugin activation flag - the plugin will not start without it***)
3. Reload VS Code window

## Extension Settings

Create an empty `ng-helper.json` file in your workspace's `.vscode` directory. The following configurations are supported:

* `componentStyleFileExt`: The file extension for component styles (e.g., `less`, `sass`). Defaults to `css`.
* `componentScriptFileExt`: Choose between `js` or `ts`. Defaults to `js`.
* `injectionCheckMode`: Dependency injection validation mode. Available options: `strict_equal`, `ignore_case_word_match`, `count_match`, and `off` (from strictest to no validation). Defaults to `count_match`.

## Known Issues

Auto-completion features (such as in HTML templates) may not work if no TypeScript/JavaScript files have been opened after launching the project. This happens because the TypeScript language service hasn't been initialized. When this occurs, a warning message will appear. Click OK to automatically open a TypeScript/JavaScript file, then return to your HTML file where auto-completion should now work properly.
