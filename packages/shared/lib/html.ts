import assert from 'assert';

// ！！！需要重构 ！！！
export function isInStartTagAnd(textBeforeCursor: string, and: (tagTextBeforeCursor: string) => boolean): boolean {
    const lastStartTagStart = textBeforeCursor.lastIndexOf('<');
    const lastEndTagStart = textBeforeCursor.lastIndexOf('</');
    // |
    // |<>
    // </|
    if (lastStartTagStart < 0 || lastEndTagStart >= lastStartTagStart) {
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

// ！！！需要重构 ！！！
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

    const quotePaired = chArr.filter((c) => c === '"').length % 2 === 0;
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
export function isInDbQuote_deprecate(tagTextBeforeCursor: string): boolean {
    // input example: '<div class="a b" ng-if="
    const chArr = Array.from(tagTextBeforeCursor);
    const quoteCnt = chArr.filter((c) => c === '"').length;
    return quoteCnt % 2 !== 0;
}
/**
 * 从标签文本中获取属性值中的字符串。
 * 注意：返回的字符串不能 trim，否则利用它计算 offset 会出错。
 * @param tagTextBeforeCursor 光标之前的一个 tag 文本字符串。
 * @returns 属性值字符串。
 */
export function getAttrValueText_old(tagTextBeforeCursor: string): string {
    const index = tagTextBeforeCursor.lastIndexOf('"');
    return tagTextBeforeCursor.slice(index + 1);
}

// ！！！需要重构 ！！！
/**
 * 获取 tag name 和光标前，且离光标最近的 attr name。
 * @param tagTextBeforeCursor 光标前的字符串。
 * @returns tag & attr name。
 */
export function getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor: string): TagAndCurrentAttrName {
    // input example: '<div class="a b" ng-if="

    assert(
        isInStartTagAnd(tagTextBeforeCursor, isInDbQuote_deprecate),
        'getTagAndTheAttrNameWhenInAttrValue() input must be "tagTextBeforeCursor", but got: ' + tagTextBeforeCursor,
    );

    const result: TagAndCurrentAttrName = { tagName: '', attrName: '' };

    const tagMatch = tagTextBeforeCursor.match(/^<([\w-]+)\s*/);
    if (tagMatch) {
        result.tagName = tagMatch[1];
    }

    // avoid <common-btn ng-click="n = n + 1
    const lastQuoteIndex = tagTextBeforeCursor.lastIndexOf('"');
    const lastAttr = tagTextBeforeCursor
        .slice(0, lastQuoteIndex)
        .split(SPACE)
        .filter((s) => s.includes('='))
        .pop();

    result.attrName = lastAttr!.split('=')[0];

    return result;
}

/**
 * 是否在 Angular.js 模版 {{}} 中。
 * 只要在 {{ }} 之间即可。
 * @param tagTextBeforeCursor 文件开始到光标前的字符串。
 * @returns 是否在其中。
 */
export function isInTemplate_deprecate(textBeforeCursor: string): boolean {
    return !!getTemplateText_old(textBeforeCursor);
}

/**
 * 从光标前的文本中获取模板内部字符串。
 * 注意：返回的字符串不能 trim，否则利用它计算 offset 会出错。
 * @param textBeforeCursor 光标前的文本字符串。
 * @returns 返回合规的光标前的模板内文本，如果没有找到，则返回undefined。
 */
export function getTemplateInnerText_deprecate(textBeforeCursor: string): string | undefined {
    const tplText = getTemplateText_old(textBeforeCursor);
    if (tplText) {
        return tplText.slice('{{'.length);
    }
}

export function getTemplateInnerTextAll_deprecate(textBeforeCursor: string, textAfterCursor: string): string | undefined {
    const prefix = getTemplateInnerText_deprecate(textBeforeCursor);

    const firstRightBraces = textAfterCursor.indexOf('}}');
    if (firstRightBraces < 0) {
        return;
    }

    const suffix = textAfterCursor.slice(0, firstRightBraces);
    if (suffix.includes('}') || suffix.includes('<') || suffix.includes('>')) {
        return;
    }

    return prefix + suffix;
}

/**
 * 从光标前的文本中获取模板字符串(包含起始的'{{')。
 *
 * @param textBeforeCursor 光标前的文本字符串。
 * @returns 返回合规的光标前的模板文本，如果没有找到，则返回undefined。
 */
export function getTemplateText_old(textBeforeCursor: string): string | undefined {
    const lastLeftBraces = textBeforeCursor.lastIndexOf('{{');
    if (lastLeftBraces < 0) {
        return;
    }

    const templateAreaText = textBeforeCursor.slice(lastLeftBraces);
    if (templateAreaText.includes('}') || templateAreaText.includes('<') || templateAreaText.includes('>')) {
        return;
    }

    return templateAreaText;
}

//=========================================================
// 下面是新函数或者重构后的函数
//=========================================================

export interface TagAndCurrentAttrName {
    tagName: string;
    attrName: string;
}

export interface ExtractString {
    str: string;
    start: number;
    length: number;
}

export const SPACE = '\u0020';

export function isContainsNgFilter(prefix: string): boolean {
    return /(^|[^|])\|([^|]|$)/.test(prefix);
}

export function getAttrValueText(htmlText: string, offset: number): ExtractString | undefined {
    return getTextInside(htmlText, offset, '"', '"');
}

export function getTemplateText(htmlText: string, offset: number): ExtractString | undefined {
    return getTextInside(htmlText, offset, '{{', '}}');
}

export function getTextInside(htmlText: string, offset: number, leftMarker: string, rightMarker: string): ExtractString | undefined {
    ensureInputValid(htmlText, offset);

    const leftBraces = htmlText.lastIndexOf(leftMarker, offset);
    if (leftBraces < 0) {
        return;
    }

    const rightBraces = htmlText.indexOf(rightMarker, offset);
    if (rightBraces < 0) {
        return;
    }

    const start = leftBraces + leftMarker.length;
    const end = rightBraces;
    if (offset >= start && offset <= end) {
        return {
            str: htmlText.slice(start, end),
            start,
            length: end - start,
        };
    }
}

function ensureInputValid(htmlText: string, offset: number) {
    if (offset < 0 || offset > htmlText.length) {
        throw new Error('offset is invalid');
    }
}
