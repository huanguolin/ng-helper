# ng-helper - Angular.js + TypeScript 开发的好帮手

[![lint & tsc & unit-test](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml/badge.svg)](https://github.com/huanguolin/ng-helper/actions/workflows/check.yml)

ng-helper 是提升 Angular.js 开发效率的助手，特别是配合 TypeScript 使用时。能提供 html 中 ng-* 指令、数据绑定自动补全、hover 类型提示，ts 文件注入校验，创建 component 右键菜单等便捷功能。

![demo](https://raw.githubusercontent.com/huanguolin/ng-helper/main/resources/demo.gif)

## Features

- [x] `ng-*` 指令自动补全
- [x] 自定义 directive 标签/属性: 自动补全, hover 提示, go to definition
- [x] 自定义 component 标签/属性: 自动补全, hover 信息提示, go to definition
- [x] ✨🆕 自定义 filter: 自动补全, hover 信息提示, go to definition
- [x] html 语法高亮，且支持 inline-html(包含语法高亮、自动补全、hover提示, go to definition)
- [x] 数据绑定（需要 `TypeScript`）: 自动补全, hover 类型提示, go to definition
- [x] 依赖注入匹配校验
  - [x] `TypeScript` 代码
  - [x] `JavaScript` 代码

> 实用小功能
- [x] 从 'templateUrl' 跳转到对应的 HTML
- [x] ✨🆕 从 'controller' 跳转到对应的实现文件
- [x] ✨🆕 点击搜索 `directive`/`component` 在哪里使用
- [x] 右键菜单创建 component


## Requirements

* 需要配合 TypeScript 才能使用，支持 TypeScript 3.5.3+
* vscode 1.80.0+


## Installation

1. 安装插件
2. 在 workspace 下的 .vscode 目录中，创建一个 ng-helper.json 空文件（***这个文件是插件启动的标志， 没有的话插件不会启动***）
3. 重启 vscode

## Extension Settings

在 workspace 下的 .vscode 目录中，创建一个 ng-helper.json 空文件, 里面支持如下配置:

* `componentStyleFileExt`: 创建 component 时，样式文件的后缀，如 `less`, `sass` 等，默认为 `css`。
* `componentScriptFileExt`: `js` 或者 `ts`. 默认值是 `js`.
* `injectionCheckMode`: 依赖注入检查的模式，值有 `strict_equal`, `ignore_case_word_match`, `count_match`, `off`, 约束从强到无，默认值是 `count_match`。

## Known Issues

在使用像自动补全这样的特性时，可能由于打开项目以后，从没有打开一个 ts/js 文件进行预览，导致 TypeScript 语言服务没有启动，无法获得自动补全。
此时会弹出一个 warning 提示框，在右下角。点击 OK 后，会自动打开一个 ts/js 文件，此时返回 html 后，自动补全将正常。

