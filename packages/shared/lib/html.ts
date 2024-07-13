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
 * Represents an HTML attribute.
 */
export interface HtmlAttr {
    name: TextSpan;
    value?: TextSpan;
}

/**
 * Represents the start tag of an HTML element.
 */
export interface HtmlStartTag {
    /**
     * The starting position of the start tag.
     */
    start: number;
    name: TextSpan;
    attrs: HtmlAttr[];
    isSelfClosing: boolean;
}

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
 * @param startTag - The HtmlStartTag object representing the start tag.
 * @param cursor - The Cursor object representing the cursor position.
 * @returns The HtmlAttr object if found, otherwise undefined.
 */
export function getTheAttrWhileCursorAtValue(startTag: HtmlStartTag, cursor: Cursor): HtmlAttr | undefined {
    const pos = cursor.isHover ? cursor.at : cursor.at - 1;
    const attr = startTag.attrs.find((a) => a.value && a.value.start <= pos && pos <= a.value.start + a.value.text.length);
    return attr;
}

/**
 * Parses the start tag text and returns an `HtmlStartTag` object.
 *
 * @param startTagText - The start tag text to parse.
 * @param baseStartAt - The base start position.
 * @returns The parsed `HtmlStartTag` object.
 * @throws Error if the start tag text is invalid.
 */
export function parseStartTagText(startTagText: string, baseStartAt = 0): HtmlStartTag {
    if (!/^<\w+([\s\S]*?)?\/?>$/m.test(startTagText)) {
        throw new Error('Invalid start tag text.');
    }

    let pos = 1; // 跳过开始的 '<'
    const len = startTagText.length;

    // 解析标签名
    const name = parseTextSpan((char) => !/\s|\/|>/.test(char));

    const attrs: HtmlAttr[] = [];
    let isSelfClosing = false;

    // 解析属性
    while (pos < len) {
        skipWhitespace();
        if (pos >= len) {
            break;
        }

        // 检查是否自闭合或结束
        if (startTagText[pos] === '/') {
            isSelfClosing = startTagText[pos + 1] === '>';
            break;
        }
        if (startTagText[pos] === '>') {
            break;
        }

        // 解析属性名和值
        const attrName = parseTextSpan((char) => !/\s|=|\/|>/.test(char));
        const attrValue = parseAttributeValue();

        attrs.push({ name: attrName, value: attrValue });
    }

    return { start: baseStartAt, name, attrs, isSelfClosing };

    function skipWhitespace() {
        while (pos < len && /\s/.test(startTagText[pos])) {
            pos++;
        }
    }

    function parseTextSpan(predicate: (char: string) => boolean): TextSpan {
        const start = pos;
        while (pos < len && predicate(startTagText[pos])) {
            pos++;
        }
        return { text: startTagText.slice(start, pos), start: baseStartAt + start };
    }

    function parseAttributeValue(): TextSpan | undefined {
        if (startTagText[pos] !== '=') {
            return undefined;
        }
        pos++; // 跳过 '='
        if (startTagText[pos] === '"') {
            pos++; // 跳过开始引号
            const value = parseTextSpan((char) => char !== '"');
            pos++; // 跳过结束引号
            return value;
        } else {
            throw new Error('Attribute names and values cannot have spaces between them.');
        }
    }
}

/**
 * 从给定的 HTML 文本中提取光标位置处所在的开始标签文本。
 * @param htmlText - 要搜索的 HTML 文本。
 * @param cursor - 光标位置信息。
 * @returns 提取的开始标签文本信息，如果未找到则返回 undefined。
 */
export function getStartTagText(htmlText: string, cursor: Cursor): CursorTextSpan | undefined {
    ensureInputValid(htmlText, cursor);

    let pos = cursor.isHover ? cursor.at : cursor.at - 1;

    // 在不在 "" 中
    const attrValueText = getTextInDbQuotes(htmlText, cursor);
    if (attrValueText) {
        // 如果在，则将光标移动到 "" 外，这里向前移动
        pos = attrValueText.start - '"'.length - 1;
    }

    let start = pos;
    let end = pos;
    let inQuotes = false;

    // 向前搜索开始标签
    while (start > 0) {
        if (htmlText[start] === '"') {
            inQuotes = !inQuotes;
        } else if (htmlText[start] === '>' && !inQuotes) {
            // 包含开始标签结尾，直接结束
            return;
        } else if (htmlText[start] === '<' && !inQuotes) {
            break;
        }
        start--;
    }

    // 如果没找到 '<'，或者找到的是结束标签 '</'，结束
    if (htmlText[start] !== '<' || htmlText[start + 1] === '/') {
        return;
    }

    // 重置引号状态
    inQuotes = false;

    // 向后搜索结束标签
    while (end < htmlText.length) {
        if (htmlText[end] === '"') {
            inQuotes = !inQuotes;
        } else if (htmlText[end] === '<' && !inQuotes) {
            // 包含开始标签的开始字符或者结束标签的开始字符，直接结束
            return;
        } else if (htmlText[end] === '>' && !inQuotes) {
            break;
        }
        end++;
    }

    // 如果没找到 '>'，结束
    if (htmlText[end] !== '>') {
        return;
    }

    // 提取标签文本
    const tagText = htmlText.slice(start, end + 1);

    return {
        text: tagText,
        start: start,
        cursor: {
            ...cursor,
            at: cursor.at - start,
        },
    };
}

/**
 * Retrieves the text enclosed in double quotes from the given HTML text at the specified cursor position.
 *
 * @param htmlText - The HTML text to search within.
 * @param cursor - The cursor position.
 * @returns The text enclosed in double quotes, or `undefined` if not found.
 */
export function getTextInDbQuotes(htmlText: string, cursor: Cursor): CursorTextSpan | undefined {
    return getTextInside(htmlText, cursor, '"', '"');
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

/**
 * Returns the text after the cursor position.
 *
 * @param cursorTextSpan - The cursor and text span information.
 * @returns The text after the cursor position.
 */
export function getAfterCursorText({ text: str, cursor }: CursorTextSpan): string {
    return str.slice(cursor.isHover ? cursor.at + 1 : cursor.at);
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
