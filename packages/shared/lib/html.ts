// import assert from "assert";

export const ASCII_SPACE = '\u0020';

export function isInStartTagAnd(textBeforeCursor: string, and: (tagTextBeforeCursor: string) => boolean) {
    const lastStartTagStart = textBeforeCursor.lastIndexOf('<');
    const lastEndTagStart = textBeforeCursor.lastIndexOf('</');
    // |
    // |<>
    // </|
    if (lastStartTagStart < 0
        || lastEndTagStart >= lastStartTagStart) {
        return false;
    }

    // > or />
    const lastStartTagEnd = textBeforeCursor.lastIndexOf('>');
    // >|
    // />|
    if (lastStartTagEnd > lastStartTagStart) {
        return false;
    }

    /**
     * ><|
     * /><|
     * <|
     */
    const tagTextBeforeCursor = textBeforeCursor.slice(lastStartTagStart);
    return and(tagTextBeforeCursor);
}

/**
 * 可否补全指令。
 * 只有三种情况不补全：
 * 1. 光标前是 '<' 或者 '='
 * 2. 光标在属性值之中, 即在双引号中
 * 3. 光标紧挨着 tag 名，比如：'<div'
 * @param tagTextBeforeCursor 开始标签的起始位置 '<' 到光标前的字符串。
 * @returns 可否补全指令。
 */
export function canCompletionNgDirective(tagTextBeforeCursor: string): boolean {
    // input example: '<div class="a b" ng-
    const chArr = Array.from(tagTextBeforeCursor);
    const lastCh = chArr[chArr.length - 1];

    if (lastCh === '<' || lastCh === '=') {
        return false;
    }

    const quotePaired = chArr.filter(c => c === '"').length % 2 == 0;
    if (!quotePaired) {
        return false;
    }

    if (/^<[\w-]+$/.test(tagTextBeforeCursor)) {
        return false;
    }

    return true;
}

/**
 * 是否在双引号 "" 中。
 * @param tagTextBeforeCursor 光标前的字符串。
 * @returns 是否在其中。
 */
export function isInDbQuote(tagTextBeforeCursor: string): boolean {
    // input example: '<div class="a b" ng-if="
    const chArr = Array.from(tagTextBeforeCursor);
    const quoteCnt = chArr.filter(c => c === '"').length;
    return quoteCnt % 2 != 0;
}

/**
* 是否在 Angular.js 模版 {{}} 中。
* 只要在 {{ }} 之间即可。
* @param tagTextBeforeCursor 文件开始到光标前的字符串。
* @returns 是否在其中。
*/
export function isInTemplate(textBeforeCursor: string): boolean {
    return !!getTemplateInnerText(textBeforeCursor);
}

/**
 * 从光标前的文本中获取模板内部字符串。
 *
 * @param textBeforeCursor 光标前的文本字符串。
 * @returns {string | undefined} 返回合规的光标前的模板内文本，如果没有找到，则返回undefined。
 */
export function getTemplateInnerText(textBeforeCursor: string): string | undefined {
    const lastLeftBraces = textBeforeCursor.lastIndexOf('{{');
    if (lastLeftBraces < 0) {
        return;
    }

    const templateAreaText = textBeforeCursor.slice(lastLeftBraces + '{{'.length);
    if (templateAreaText.includes('}')
        || templateAreaText.includes('<')
        || templateAreaText.includes('>')) {
        return;
    }

    return templateAreaText;
}
