# Change Log

All notable changes to the "ng-helper" extension will be documented in this file.

## [v0.9.0](https://github.com/huanguolin/ng-helper/compare/v0.8.0...v0.9.0) (2025-06-21)

### Feature
- Support Angular.js expression diagnostics in HTML templates.
- Added `ngProjects` configuration option for better project management.
- Enhanced status bar with improved state display and user-friendly interface.

### Fixed
- Fixed issue where ng-helper becomes unresponsive in certain scenarios (#19).
- Fixed incorrect semantic highlighting for directive attributes with string values on components.

## [v0.8.0](https://github.com/huanguolin/ng-helper/compare/v0.7.1...v0.8.0) (2025-03-21)

### Feature
- Support auto-completion, hover info, and go to definition for `ng-repeat`.
- Enhanced go to definition capability - previously only supported first level data binding jumps, now there's no limitation.
- Custom services can jump to implementation files by their names.
- HTML can jump to controller implementation files via controller name (TypeScript independent).
- Built-in `ng-*` directives completed.


## [v0.7.1](https://github.com/huanguolin/ng-helper/compare/v0.7.0...v0.7.1) (2024-12-12)

### Fixed
- Fix the working area of the filter hover/definition is smaller than it's completion.


## [v0.7.0](https://github.com/huanguolin/ng-helper/compare/v0.6.0...v0.7.0) (2024-11-28)

### Feature
- Support filters: auto-completion, hover hints, go to definition.
- Jump from 'controller' name to the implement `js`/`ts` file.
- Click to search for 'directive'/'component' where to use.


## [v0.6.0](https://github.com/huanguolin/ng-helper/compare/v0.5.0...v0.6.0) (2024-10-01)

### Feature
- Dependency injection validation support for `js` files.
- Dependency injection validation now supports more types: `controller`, `component`, `directive`, `filter`, `service`, `provider`, `config`, `factory`, `run`.(previously only `controller`, `component`, `service`).
- The dependency injection check supports mode configuration to control the stringency of the check. See `injectionCheckMode` in the `Extension Settings` section of the README for details.
- Create a component supports configuring the script file to have a `js` (default) or `ts` suffix (see `componentScriptFileExt` in the `Extension Settings`).

### Break Change
- Change the name of `componentCssFileExt` to `componentStyleFileExt` in the `Extension settings`.

### Fixed
- Fix the problem of not reading out multiple directives or components in the same file.


## [v0.5.0](https://github.com/huanguolin/ng-helper/compare/v0.4.0...v0.5.0) (2024-09-17)

### Feature
- Custom directive tags/attributes now support auto-completion, hover hints, go to definition.

### Fixed
- HTML syntax highlight not working on the directive attribute (#17).
- In non-html areas of js/ts pages with inline html, typing a space also prompts for component completion (#18).


## [v0.4.0](https://github.com/huanguolin/ng-helper/compare/v0.3.0...v0.4.0) (2024-09-08)

### Feature
- Syntax highlight for js in HTML.
- Syntax highlight for HTML in js/ts.
- Completion, hover hint, go to definition for HTML in js/ts.
- Improve go to HTML file via 'templateUrl' form ts/js.

### Fixed
- Hovering does not work on ng directive attrs (#15).


## [v0.3.0](https://github.com/huanguolin/ng-helper/compare/v0.2.0...v0.3.0) (2024-08-28)

### Feature
- Support go to HTML file via 'templateUrl' form ts/js.
- Support hover hint for `ng-*`.


## [v0.2.0](https://github.com/huanguolin/ng-helper/compare/v0.1.5...v0.2.0) (2024-08-24)

### Feature
- Support go to definition for component and controller data bindings.
- Support go to definition for component name and attr.


## [v0.1.5](https://github.com/huanguolin/ng-helper/compare/v0.1.4...v0.1.5) (2024-08-21)

### Feature
- Support hover hint for transclude element.

### Fixed
- Autocomplete transclude element name should use 'kebabCase' but got 'camelCase' (#14).
- Hover last char of start tag name of component is not popup hint info (#12).
- get wrong type info while autocomplete component attr or hover it (#8).


## [v0.1.4](https://github.com/huanguolin/ng-helper/compare/v0.1.3...v0.1.4) (2024-08-20)

### Fixed
- Autocomplete component attr did not contain the '&' bindings prop (#11).


## [v0.1.3](https://github.com/huanguolin/ng-helper/compare/v0.1.2...v0.1.3) (2024-08-20)

### Improve
- Add transclude info for component name hover.
- Improve autocomplete for component name with transclude.


## [v0.1.2](https://github.com/huanguolin/ng-helper/compare/v0.1.1...v0.1.2) (2024-08-19)

### Fixed
- Do not auto-complete component name with self-closing (#9).


## [v0.1.1](https://github.com/huanguolin/ng-helper/compare/v0.1.0...v0.1.1) (2024-08-06)

### Fixed
- Hover hint for component name & attr name not working on component html (#7).


## [v0.1.0](https://github.com/huanguolin/ng-helper/compare/v0.0.8...v0.1.0) (2024-08-05)

### Feature
- HTML using `ng-controller="XController as ctrl"` with `XController` implemented in TS:
  - Auto-completion for data binding.
  - Type hints on hover.
- Hover information for component tag names in HTML.
- Hover information for component attributes in HTML.

### Fixed
- Hover hint not working on `<x-label ng-if="ctrl.type === 'content'" ng-class="[ctrl.editable]" />` (#4, #5).


## [v0.0.8](https://github.com/huanguolin/ng-helper/compare/v0.0.7...v0.0.8) (2024-07-28)

### Feature
- Support for multiple projects.
- Auto-completion for component names in HTML.
- Auto-completion for component property names in HTML.

### Improvement
- Function completion split into two stages.
- Component hover support for cases without a class controller.

### Fixed
- Incorrect suggestions for ng-* auto-completion in templates {{}} (#3).


## [v0.0.7](https://github.com/huanguolin/ng-helper/compare/v0.0.6...v0.0.7) (2024-07-19)

### Improvement
- Improved support for auto-completion, hover type hints for accessing elements such as arrays.


## [v0.0.6](https://github.com/huanguolin/ng-helper/compare/v0.0.5...v0.0.6) (2024-07-17)

### Fixed
- 'ctrl' auto completion not working on `<div ng-class="c">`(#2).


## [v0.0.5](https://github.com/huanguolin/ng-helper/compare/64dde84...v0.0.5) (2024-07-16)

### Fixed
- Hover hint not working on some special place(#1).
