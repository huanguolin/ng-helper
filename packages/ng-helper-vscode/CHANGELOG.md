# Change Log

All notable changes to the "ng-helper" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [v0.1.0](https://github.com/huanguolin/ng-helper/compare/v0.0.8...v0.1.0) (2024-08-05)

### Feature
- Auto-completion for data binding for HTML using `ng-controller="XController as ctrl"` with `XController` 
- Type hints on hover for HTML using `ng-controller="XController as ctrl"` with `XController` 
- Hover information for component tag names
- Hover information for component attributes

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
