
# ng-helper - The Perfect Assistant for Angular.js with TypeScript Development

[![lint & tsc & unit-test](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml/badge.svg)](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml)

> [中文文档](https://github.com/huanguolin/ng-helper/blob/main/packages/ng-helper-vscode/README.zh_cn.md)

ng-helper enhances the efficiency of Angular.js development, especially when used with TypeScript. It provides convenient features such as auto-completion for ng-* directives and data binding in HTML, hover type hints, injection validation in ts files, right-click context menu for creating components, and more.

![demo](https://raw.githubusercontent.com/huanguolin/ng-helper/main/resources/demo.gif)

## Features

- [x] `ng-*` directive auto-completion (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/builtin-directives-demo.gif" target="_blank">see demo</a>)
- [x] Custom directive tags/attributes: auto-completion, hover hints, go to definition (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/directives-demo.gif" target="_blank">see demo</a>)
- [x] Custom component tags/attributes: auto-completion, hover hints, go to definition (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/components-demo.gif" target="_blank">see demo</a>)
- [x] ✨🆕 Custom filter: auto-completion, hover hints, go to definition (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/filters-demo.gif" target="_blank">see demo</a>)
- [x] HTML syntax highlighting, supporting inline HTML (including syntax highlighting,auto-completion, hover hints, Go to definition) (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/inline-html-demo.gif" target="_blank">see demo</a>)
- [x] Data binding (Require `TypeScript`): auto-completion, hover type hints, go to definition (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/data-binding-demo.gif" target="_blank">see demo</a>)
- [x] Dependency injection matching validation (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/injection-validate-demo.gif" target="_blank">see demo</a>)
  - [x] `TypeScript` code
  - [x] `JavaScript` code

> Useful utilities features:
- [x] Jump from 'templateUrl' to the corresponding HTML (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/template-url-jump-demo.gif" target="_blank">see demo</a>)
- [x] ✨🆕 Jump from 'controller' to the implement `js`/`ts` file (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/controller-jump-demo.gif" target="_blank">see demo</a>)
- [x] ✨🆕 Click to search for 'directive'/'component' where to use (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/search-component-use-demo.gif" target="_blank">see demo</a>)
- [x] Right-click menu to create components (<a href="https://raw.githubusercontent.com/huanguolin/ng-helper/refs/heads/main/resources/create-component-demo.gif" target="_blank">see demo</a>)

## Requirements

* vscode 1.80.0+
* TypeScript 3.5.3+ (Some features require this, see above) 

## Installation

1. Install the extension
2. Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace(***This file is a plugin startup flag, without which the plugin will not start***)
3. Restart vscode

## Extension Settings

Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace. It supports the following configuration:

* `componentStyleFileExt`: The suffix for the style file when creating a component, such as `less`, `sass`, etc. The default value is `css`.
* `componentScriptFileExt`: `js` or `ts`. The default value is `js`.
* `injectionCheckMode`: The modes for dependency injection check include `strict_equal`, `ignore_case_word_match`, `count_match`, and `off`, with constraints ranging from strict to none. The default value is `count_match`.

## Known Issues

When using feature like auto-completion in the html template, it may not work if no ts/js file has been opened for preview after the project is opened. This can cause the TypeScript language service to not start, resulting in no auto-completion. In this case, an warning message will pop up in the lower right corner. Click OK, and a ts/js file will automatically open. After that, return to the HTML file, and the auto-completion should work normally.
