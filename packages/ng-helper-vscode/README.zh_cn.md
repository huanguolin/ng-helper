# ng-helper - Angular.js + TypeScript 开发的好帮手

[![lint & tsc & unit-test](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml/badge.svg)](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml)

ng-helper 是提升 Angular.js 开发效率的助手，特别是配合 TypeScript 使用时。能提供 html 中 ng-* 指令、数据绑定自动补全、hover 类型提示，ts 文件注入校验，创建 component 右键菜单等便捷功能。

![demo](https://raw.githubusercontent.com/huanguolin/ng-helper/main/resources/demo.gif)

## Features

- [x] `ng-*` 指令自动补全
- [x] 自定义 directive 标签/属性: 自动补全, hover 提示, go to definition
- [x] 自定义 component 标签/属性: 自动补全, hover 信息提示, go to definition
- [x] html 语法高亮，且支持 inline-html(包含语法高亮、自动补全、hover提示, go to definition)
- [x] 从 'templateUrl' 跳转到对应的 HTML
- [x] 右键菜单创建 component
- [ ] 依赖注入匹配校验
  - [x] `TypeScript` 代码
  - [ ] `JavaScript` 代码

> 下面的功能需要使用 `TypeScript` 才能支持

- [x] 数据绑定: 自动补全, hover 类型提示, go to definition


## Requirements

* 需要配合 TypeScript 才能使用，支持 TypeScript 3.5.3+
* vscode 1.80.0+


## Installation

1. 安装插件
2. 在 workspace 下的 .vscode 目录中，创建一个 ng-helper.json 空文件（***这个文件是插件启动的标志， 没有的话插件不会启动***）
3. 重启 vscode

## Extension Settings

在 workspace 下的 .vscode 目录中，创建一个 ng-helper.json 空文件, 里面支持如下配置:

* `componentCssFileExt`: 创建 component 时，css 文件的后缀，如 `less`, `sass` 等，默认为 `css`。

## Known Issues

在 component 模版中使用数据绑定自动补全时，可能由于打开项目以后，从没有打开一个 ts 文件进行预览，导致 TypeScript 语言服务没有启动，无法获得自动补全。
此时会弹出一个 error 提示框，在右下角。点击 OK 后，会自动打开一个 ts 文件，此时返回 html 后，自动补全将正常。

