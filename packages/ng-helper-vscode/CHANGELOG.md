# Change Log

All notable changes to the "ng-helper" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [v0.3.0](https://github.com/huanguolin/ng-helper/compare/v0.2.0...v0.3.0) (2024-08-28)

### Feature
- Support go to HTML file via 'templateUrl' form ts/js
- Support hover hint for ng-*


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
- Do not auto-complete component name with self-closing (#9)


## [v0.1.1](https://github.com/huanguolin/ng-helper/compare/v0.1.0...v0.1.1) (2024-08-06)

### Fixed
- Hover hint for component name & attr name not working on component html (#7)


## [v0.1.0](https://github.com/huanguolin/ng-helper/compare/v0.0.8...v0.1.0) (2024-08-05)

### Feature
- HTML using `ng-controller="XController as ctrl"` with `XController` implemented in TS
  - Auto-completion for data binding
  - Type hints on hover
- Hover information for component tag names in HTML
- Hover information for component attributes in HTML

### Fixed
- Hover hint not working on `<x-label ng-if="ctrl.type === 'content'" ng-class="[ctrl.editable]" />` (#4, #5)


## [v0.0.8](https://github.com/huanguolin/ng-helper/compare/v0.0.7...v0.0.8) (2024-07-28)

### Feature
- Support for multiple projects
- Auto-completion for component names in HTML
- Auto-completion for component property names in HTML

### Improvement
- Function completion split into two stages
- Component hover support for cases without a class controller

### Fixed
- Incorrect suggestions for ng-* auto-completion in templates {{}} (#3)


## [v0.0.7](https://github.com/huanguolin/ng-helper/compare/v0.0.6...v0.0.7) (2024-07-19)

### Improvement
- Improved support for auto-completion, hover type hints for accessing elements such as arrays.


## [v0.0.6](https://github.com/huanguolin/ng-helper/compare/v0.0.5...v0.0.6) (2024-07-17)

### Fixed
- 'ctrl' auto completion not working on `<div ng-class="c">`(#2).


## [v0.0.5](https://github.com/huanguolin/ng-helper/compare/64dde84...v0.0.5) (2024-07-16)

### Fixed
- Hover hint not working on some special place(#1).
