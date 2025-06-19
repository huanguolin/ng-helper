import { isHtmlTagName } from './html';

export const builtinStringDirectives = [
    // 应用和模块配置
    'ng-app', // "@" - 模块名称字符串
    'ng-csp', // "@" - 内容安全策略配置
    'ng-strict-di', // "@" - 严格依赖注入模式

    // 资源路径
    'ng-src', // "@" - 图片源地址
    'ng-href', // "@" - 链接地址
    'ng-srcset', // "@" - 响应式图片源
    'ng-include', // "@" - 模板路径

    // 模板绑定
    'ng-bind-template', // "@" - 模板字符串（如: "{{firstName}} {{lastName}}"）

    // 表单相关
    'ng-form', // "@" - 表单名称
    'ng-pattern', // "@" - 正则表达式字符串
    'ng-minlength', // "@" - 最小长度数字字符串
    'ng-maxlength', // "@" - 最大长度数字字符串
    'ng-list', // "@" - 分隔符字符串（默认逗号）

    // 其他配置
    'ng-jq', // "@" - jQuery版本字符串
    'ng-cloak', // "@" - 防止模板闪烁（无值或空字符串）
];

// 注意：还有 ng-on-{eventName} 事件绑定
export const builtinExpressionDirectives = [
    // 控制器表达式
    'ng-controller', // "<" - 控制器表达式（如: "MyController as vm"）

    // "=" 双向绑定
    'ng-model', // "=" - 双向数据绑定

    // "<" 单向数据绑定
    'ng-bind', // "<" - 单向表达式绑定
    'ng-bind-html', // "<" - HTML表达式绑定
    'ng-value', // "<" - 值表达式绑定
    'ng-init', // "<" - 初始化表达式

    // 样式和类
    'ng-class', // "<" - 类表达式
    'ng-style', // "<" - 样式表达式
    'ng-class-even', // "<" - 偶数行类表达式
    'ng-class-odd', // "<" - 奇数行类表达式

    // 条件控制
    'ng-if', // "<" - 条件表达式
    'ng-show', // "<" - 显示表达式
    'ng-hide', // "<" - 隐藏表达式
    'ng-switch', // "<" - 切换表达式
    'ng-switch-when', // "<" - 切换条件匹配
    'ng-switch-default', // "<" - 切换默认条件

    // 循环控制
    'ng-repeat', // "<" - 循环表达式
    'ng-repeat-start', // "<" - 复杂循环开始
    'ng-repeat-end', // "<" - 复杂循环结束

    // 表单状态
    'ng-disabled', // "<" - 禁用状态表达式
    'ng-readonly', // "<" - 只读状态表达式
    'ng-checked', // "<" - 选中状态表达式
    'ng-selected', // "<" - 选择状态表达式
    'ng-required', // "<" - 必填状态表达式
    'ng-multiple', // "<" - 多选状态表达式
    'ng-open', // "<" - 打开状态表达式
    'ng-trim', // "<" - 是否去除前后空格

    // 选项和内容
    'ng-options', // "<" - 选项表达式
    'ng-transclude', // "<" - 内容传递
    'ng-non-bindable', // "<" - 不绑定标记
    'ng-pluralize', // "<" - 复数形式表达式

    // 表单验证消息
    'ng-messages', // "<" - 验证消息容器
    'ng-message', // "<" - 单个验证消息
    'ng-message-exp', // "<" - 验证消息表达式

    // "&" 函数绑定（事件处理）
    'ng-click', // "&" - 点击事件
    'ng-dblclick', // "&" - 双击事件
    'ng-submit', // "&" - 表单提交事件
    'ng-change', // "&" - 值改变事件

    // 焦点事件
    'ng-focus', // "&" - 获得焦点事件
    'ng-blur', // "&" - 失去焦点事件

    // 鼠标事件
    'ng-mousedown', // "&" - 鼠标按下事件
    'ng-mouseup', // "&" - 鼠标抬起事件
    'ng-mouseenter', // "&" - 鼠标进入事件
    'ng-mouseleave', // "&" - 鼠标离开事件
    'ng-mousemove', // "&" - 鼠标移动事件
    'ng-mouseover', // "&" - 鼠标悬停事件
    'ng-mouseout', // "&" - 鼠标移出事件

    // 键盘事件
    'ng-keydown', // "&" - 键盘按下事件
    'ng-keyup', // "&" - 键盘抬起事件
    'ng-keypress', // "&" - 键盘按键事件

    // 编辑事件
    'ng-copy', // "&" - 复制事件
    'ng-cut', // "&" - 剪切事件
    'ng-paste', // "&" - 粘贴事件

    // 触摸事件（AngularJS 1.3+）
    'ng-swipe-left', // "&" - 左滑事件
    'ng-swipe-right', // "&" - 右滑事件
];

export function isNgBuiltinExpressionDirective(attrName: string): boolean {
    return builtinExpressionDirectives.includes(attrName) || attrName.startsWith('ng-on-');
}

export function isComponentTagName(name: string): boolean {
    return name.includes('-') || !isHtmlTagName(name);
}

export function isNgBuiltinDirective(attrName: string): boolean {
    return attrName.startsWith('ng-');
}

export function isNgUserCustomAttr(attrName: string): boolean {
    return (
        !isNgBuiltinDirective(attrName) &&
        attrName.includes('-') &&
        !attrName.startsWith('data-') &&
        attrName !== 'accept-charset'
    );
}
