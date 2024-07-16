import { ChildNode, Document } from 'domhandler';
import { ElementType, parseDocument } from 'htmlparser2';
import { parseFragment } from 'parse5';
import { Element } from 'parse5/dist/tree-adapters/default';

/**
 * Represents a span of text with its starting position.
 */
export interface TextSpan {
    /**
     * The text content of the span.
     */
    text: string;

    /**
     * The starting position of the span.
     */
    start: number;
}

/**
 * Represents a cursor with position and hover state.
 */
export interface Cursor {
    /**
     * The position of the cursor.
     */
    at: number;

    /**
     * hover 时，光标在某个字符上, at 的值就是对应字符的位置。
     * 否则，光标在字符之间，是虚拟的，并不占一个字符, 但 at 的值是光标后一个字符的位置。
     */
    isHover: boolean;
}

/**
 * Represents a text span with a cursor.
 */
export interface CursorTextSpan extends TextSpan {
    /**
     * The cursor associated with the text span.
     */
    cursor: Cursor;
}

/**
 * Represents an HTML tag.
 */
export type HtmlTag = {
    tagName: string;
    attrs: HtmlAttr[];
    start: number;
    end: number;
    startTagEnd: number | undefined;
    endTagStart: number | undefined;
};

/**
 * Represents an HTML attribute.
 */
export type HtmlAttr = {
    name: TextSpan;
    value?: TextSpan;
};

export const SPACE = '\u0020';

export const NG_FILTER_PATTERN = /(^|[^|])\|([^|]|$)/;

/**
 * Checks if the given text contains an Angular filter.
 * @param text - The text to check.
 * @returns A boolean indicating whether the text contains an Angular filter.
 */
export function isContainsNgFilter(text: string): boolean {
    return NG_FILTER_PATTERN.test(text);
}

/**
 * Finds the index of the first occurrence of an Angular filter in the given text.
 *
 * @param text - The text to search for the Angular filter.
 * @returns The index of the first occurrence of the Angular filter, or -1 if not found.
 */
export function indexOfNgFilter(text: string): number {
    const matched = text.match(NG_FILTER_PATTERN);
    if (matched && typeof matched.index === 'number') {
        return matched.index + matched[1].length;
    }
    return -1;
}

/**
 * Retrieves the HtmlAttr object while the cursor is at the value position.
 *
 * @param tag - The HtmlTag object.
 * @param cursor - The Cursor object representing the current position.
 * @returns The HtmlAttr object if the cursor is within the value position of an attribute, otherwise undefined.
 */
export function getTheAttrWhileCursorAtValue(tag: HtmlTag, cursor: Cursor): HtmlAttr | undefined {
    const pos = cursor.isHover ? cursor.at : cursor.at - 1;

    if (pos < tag.start || pos >= (tag.startTagEnd ?? tag.end)) {
        return;
    }

    return tag.attrs.find((attr) => attr.value && attr.value.start <= pos && pos < attr.value.start + attr.value.text.length);
}

/**
 * Parses the given HTML text and returns a Document object.
 *
 * @param htmlText - The HTML text to parse.
 * @returns The parsed Document object.
 */
export function parseHtml(htmlText: string): Document {
    return parseDocument(htmlText, { withStartIndices: true, withEndIndices: true });
}

/**
 * Retrieves the HTML tag at the specified cursor position in the given HTML text.
 * @param htmlText - The HTML text.
 * @param cursor - The cursor position.
 * @returns The HTML tag at the cursor position, or undefined if no tag is found.
 */
export function getHtmlTagByCursor(htmlText: string, cursor: Cursor): HtmlTag | undefined {
    ensureInputValid(htmlText, cursor);

    const document = parseHtml(htmlText);
    const cursorAt = cursor.isHover ? cursor.at : cursor.at - 1;
    const tag = findTargetTag();
    if (!tag) {
        return;
    }

    const fragment = htmlText.slice(tag.startIndex!, tag.endIndex! + 1);
    const element = parseFragment(fragment, { sourceCodeLocationInfo: true }).childNodes[0] as Element;

    const start = tag.startIndex!;
    // 注意：end, endOffset 是不含的，但 endIndex 是含的
    const end = tag.endIndex! + 1;

    // 注意:
    // element 中 tag 的起始位置（比如：startTag.startOffset = 0）。
    // 所以最终的结果要加上 start.

    let startTagEnd: number | undefined;
    let endTagStart: number | undefined;
    if (typeof element.sourceCodeLocation?.startTag?.endOffset === 'number') {
        startTagEnd = start + element.sourceCodeLocation.startTag.endOffset;
    }
    if (typeof element.sourceCodeLocation?.endTag?.startOffset === 'number') {
        endTagStart = start + element.sourceCodeLocation.endTag.startOffset;
    }

    return {
        tagName: element.tagName,
        attrs: buildTagAttrs(),
        start,
        end,
        startTagEnd,
        endTagStart,
    };

    function findTargetTag(): ChildNode | undefined {
        for (const childNode of document.children) {
            const target = findTargetTagInner(childNode);
            if (target) {
                return target;
            }
        }
    }

    function findTargetTagInner(node: ChildNode): ChildNode | undefined {
        if (node.type === ElementType.Tag && cursorAt >= node.startIndex! && cursorAt <= node.endIndex!) {
            for (const childNode of node.children) {
                const target = findTargetTagInner(childNode);
                if (target) {
                    return target;
                }
            }
            return node;
        }
    }

    function buildTagAttrs(): HtmlAttr[] {
        const { attrs } = element.sourceCodeLocation!;
        return element.attrs.map((attr) => {
            const location = attrs![attr.name];
            const item: HtmlAttr = {
                name: {
                    text: attr.name,
                    start: start + location.startOffset,
                },
            };
            if (!attr.value) {
                return item;
            }
            const attrText = htmlText.slice(start + location.startOffset, start + location.endOffset);
            const attrValueStart = attrText.indexOf(attr.value);
            item.value = {
                text: attr.value,
                start: start + location.startOffset + attrValueStart,
            };
            return item;
        });
    }
}

/**
 * Retrieves the text inside a template string based on the provided cursor position.
 *
 * @param htmlText - The HTML template string.
 * @param cursor - The cursor position.
 * @returns The text span inside the template string, delimited by '{{' and '}}', that contains the cursor position.
 */
export function getTextInTemplate(htmlText: string, cursor: Cursor): CursorTextSpan | undefined {
    return getTextInside(htmlText, cursor, '{{', '}}');
}

/**
 * Retrieves the text inside the given HTML text between the left and right markers.
 * @param htmlText - The HTML text to search within.
 * @param cursor - The cursor position.
 * @param leftMarker - The left marker.
 * @param rightMarker - The right marker.
 * @returns The text span between the left and right markers, along with the updated cursor position.
 *          Returns undefined if the markers are not found or if the text span contains the markers.
 */
export function getTextInside(htmlText: string, cursor: Cursor, leftMarker: string, rightMarker: string): CursorTextSpan | undefined {
    ensureInputValid(htmlText, cursor);

    // 注意：这里是要取 Inside 的文本，不含左右标记。所以不是 hover 时，at 要减 1。
    const pos = cursor.isHover ? cursor.at : cursor.at - 1;

    const leftIndex = htmlText.lastIndexOf(leftMarker, pos);
    if (leftIndex < 0) {
        return;
    }

    const rightIndex = htmlText.indexOf(rightMarker, pos);
    if (rightIndex < 0) {
        return;
    }

    const start = leftIndex + leftMarker.length;
    const end = rightIndex;
    if (pos >= start && pos <= end) {
        const str = htmlText.slice(start, end);
        if (str.includes(leftMarker) || str.includes(rightMarker)) {
            return;
        }

        return {
            text: str,
            start,
            cursor: {
                ...cursor,
                at: cursor.at - start,
            },
        };
    }
}

/**
 * Retrieves the text before the cursor position.
 *
 * @param cursorTextSpan - The cursor and text information.
 * @returns The text before the cursor position.
 */
export function getBeforeCursorText({ text: str, cursor }: CursorTextSpan): string {
    return str.slice(0, cursor.isHover ? cursor.at + 1 : cursor.at);
}

function ensureInputValid(htmlText: string, cursor: Cursor) {
    if (cursor.at < 0 || (cursor.isHover ? cursor.at >= htmlText.length : cursor.at > htmlText.length)) {
        throw new Error('"cursorAt" is invalid.');
    }
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

    const quotePaired = chArr.filter((c) => c === '"').length % 2 === 0;
    if (!quotePaired) {
        return false;
    }

    if (/^<[\w-]+$/.test(tagTextBeforeCursor)) {
        return false;
    }

    return true;
}

// 特殊处理:
// 输入：{ 'class-x': ctrl.x, 'class-y': ctrl.y, z: ctrl.z > 5 }
// 输出：[ctrl.x, ctrl.y, ctrl.z > 5]
export function getMapValues(mapString: string): TextSpan[] | undefined {
    const start = mapString.indexOf('{');
    const end = mapString.indexOf('}');
    if (start < 0 || end < 0 || start > end) {
        return;
    }

    const arr = mapString.slice(start + 1, end).split(/[:,]/);
    if (arr.length % 2 !== 0 || arr.length !== arr.filter((x) => x.trim()).length) {
        // not paired
        return;
    }

    const result: TextSpan[] = [];
    let baseStart = start + 1;
    for (let i = 0; i < arr.length; i++) {
        const text = arr[i];
        if ((i + 1) % 2 === 0) {
            result.push({
                text,
                start: baseStart,
            });
        }
        baseStart += text.length + 1; // ':' or ','
    }
    return result;
}
