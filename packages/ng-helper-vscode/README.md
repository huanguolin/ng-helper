
# ng-helper - The Perfect Assistant for Angular.js with TypeScript Development

[![lint & tsc & unit-test](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml/badge.svg)](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml)

> [中文文档](https://github.com/huanguolin/ng-helper/blob/main/packages/ng-helper-vscode/README.zh_cn.md)

ng-helper enhances the efficiency of Angular.js development, especially when used with TypeScript. It provides convenient features such as auto-completion for ng-* directives and data binding in HTML, hover type hints, injection validation in ts files, right-click context menu for creating components, and more.

![demo](https://raw.githubusercontent.com/huanguolin/ng-helper/main/resources/demo.gif)

## Features

- [x] HTML
  - [x] Auto-completion for `ng-*` directives
  - [x] Auto-completion for component tag names
  - [x] Auto-completion for component attributes
  - [x] Hover information for component tag names
  - [x] Hover information for component attributes
  - [x] Syntax highlighting
  - [ ] For HTML using `ng-controller="XController as ctrl"` with `XController` implemented in TS
    - [x] Auto-completion for data binding
    - [x] Type hints on hover
    - [x] Jump to definition of component tags or their attributes
    - [x] Jump to TS definition of bound data
    - [ ] Function signature help in HTML
- [x] Component:
  - [x] Right-click menu to create component
  - [x] Auto-completion for data binding in HTML
  - [x] Type hints on hover in HTML
  - [x] Auto-completion for component tag names in HTML
  - [x] Auto-completion for component attributes in HTML
  - [x] Jump to definition of component tags or their attributes in HTML
  - [x] Jump to TS definition of bound data in HTML
  - [x] Syntax highlighting in HTML
  - [ ] Function signature help in HTML
- [x] Injection matching validation in TS files
- [x] Support go to HTML file via 'templateUrl' form ts/js
- [x] Inline HTML support in ts/js (including code highlighting, auto-completion, hover, etc.)


## Requirements

* Requires TypeScript, supporting TypeScript 3.5.3+
* vscode 1.80.0+

## Installation

1. Install the extension
2. Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace(***This file is a plugin startup flag, without which the plugin will not start***)
3. Restart vscode

## Extension Settings

Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace. It supports the following configuration:

* `componentCssFileExt`: The suffix for the CSS file when creating a component, such as `less`, `sass`, etc. The default is `css`.

## Known Issues

When using data binding auto-completion in the component template, it may not work if no ts file has been opened for preview after the project is opened. This can cause the TypeScript language service to not start, resulting in no auto-completion. In this case, an error message will pop up in the lower right corner. Click OK, and a ts file will automatically open. After that, return to the HTML file, and the auto-completion should work normally.
