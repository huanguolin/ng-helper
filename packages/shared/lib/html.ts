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

// ！！！需要重构 ！！！
/**
 * 获取 tag name 和光标前，且离光标最近的 attr name。
 * @param tagTextBeforeCursor 光标前的字符串。
 * @returns tag & attr name。
 */
export function getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor: string): TagAndCurrentAttrName {
    // input example: '<div class="a b" ng-if="

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
    relativeOffset: number;
}

export const SPACE = '\u0020';

export function isContainsNgFilter(text: string): boolean {
    return /(^|[^|])\|([^|]|$)/.test(text);
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
        const str = htmlText.slice(start, end);
        if (str.includes(leftMarker) || str.includes(rightMarker)) {
            return;
        }

        return {
            str,
            start,
            length: end - start,
            relativeOffset: offset - start,
        };
    }
}

function ensureInputValid(htmlText: string, offset: number) {
    if (offset < 0 || offset > htmlText.length) {
        throw new Error('offset is invalid');
    }
}
