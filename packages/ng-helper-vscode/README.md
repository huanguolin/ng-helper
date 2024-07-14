
# ng-helper - The Perfect Assistant for Angular.js with TypeScript Development

> [中文文档](https://github.com/huanguolin/ng-helper/blob/main/packages/ng-helper-vscode/README.zh_cn.md)

ng-helper enhances the efficiency of Angular.js development, especially when used with TypeScript. It provides convenient features such as auto-completion for ng-* directives and data binding in HTML, hover type hints, injection validation in ts files, right-click context menu for creating components, and more.

## Features

- [x] Auto-completion for ng-* directives in HTML
- [x] Component:
  - [x] Right-click context menu for creating components
  - [x] Auto-completion for data binding in HTML
  - [x] Hover type hints in HTML
  - [ ] Signature help in HTML
  - [ ] Navigation from HTML to ts definitions
  - [ ] Auto-completion for component tag names in HTML
  - [ ] Auto-completion for component attributes in HTML
  - [ ] Syntax highlighting in HTML
- [x] Injection matching validation in ts files

## Requirements

* Requires TypeScript, supporting TypeScript 3.5.3+
* vscode 1.80.0+

## Installation

1. Install the extension
2. Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace
3. Restart vscode

## Extension Settings

Create an empty `ng-helper.json` file in the `.vscode` directory of your workspace. It supports the following configuration:

* `componentCssFileExt`: The suffix for the CSS file when creating a component, such as `less`, `sass`, etc. The default is `css`.

## Known Issues

When using data binding auto-completion in the component template, it may not work if no ts file has been opened for preview after the project is opened. This can cause the TypeScript language service to not start, resulting in no auto-completion. In this case, an error message will pop up in the lower right corner. Click OK, and a ts file will automatically open. After that, return to the HTML file, and the auto-completion should work normally.
