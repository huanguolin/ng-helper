# ng-helper - Angular.js + TypeScript 开发的好帮手

ng-helper 是提升 Angular.js 开发效率的助手，特别是配合 TypeScript 使用时。能提供 html 中 ng-* 指令、数据绑定自动补全、hover 类型提示，ts 文件注入校验，创建 component 右键菜单等便捷功能。


## Features

- [x] html 中 ng-* 指令自动补全
- [x] Component:
  - [x] component 创建右键菜单
  - [x] html 数据绑定自动补全
  - [x] html hover 类型提示
  - [ ] html 中跳转到 ts 定义位置
  - [ ] html 中 component 标签名字自动补全
  - [ ] html 中 component 属性自动补全
  - [ ] html 中语法高亮
- [x] ts 文件注入匹配校验


## Requirements

* 需要配合 TypeScript 才能使用，支持 TypeScript 3.5.3+
* vscode 1.80.0+


## Installation

1. 安装插件
2. 在 workspace 下的 .vscode 目录中，创建一个 ng-helper.json 空文件
3. 重启 vscode

## Extension Settings

在 workspace 下的 .vscode 目录中，创建一个 ng-helper.json 空文件, 里面支持如下配置:

* `componentCssFileExt`: 创建 component 时，css 文件的后缀，如 `less`, `sass` 等，默认为 `css`。

## Known Issues

在 component 模版中使用数据绑定自动补全时，可能由于打开项目以后，从没有打开一个 ts 文件进行预览，导致 TypeScript 语言服务没有启动，无法获得自动补全。
此时会弹出一个 error 提示框，在右下角。点击 OK 后，会自动打开一个 ts 文件，此时返回 html 后，自动补全将正常。

