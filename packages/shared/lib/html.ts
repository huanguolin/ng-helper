import { parseFragment } from 'parse5';
import type { Attribute, Location } from 'parse5/dist/common/token';
import type { Element, DocumentFragment, TextNode, ChildNode } from 'parse5/dist/tree-adapters/default';

import { LRUCache } from './lruCache';

export { DocumentFragment, Attribute, Location, Element, TextNode, ChildNode };

type HtmlAstCache = {
    version: number;
    ast: DocumentFragment;
};

export type HtmlAstCacheMeta = {
    filePath: string;
    version: number;
};

const htmlAstCache = new LRUCache<HtmlAstCacheMeta, HtmlAstCache>(10);

/**
 * 解析 HTML 片段，并缓存结果。
 * @param htmlText - 要解析的 HTML 文本。
 * @param key - 缓存的键。
 * @param version - 缓存的版本。
 * @returns 解析后的 HTML 片段。
 */
export function parseHtmlFragmentWithCache(htmlText: string, meta?: HtmlAstCacheMeta): DocumentFragment {
    if (!meta) {
        return parseFragment(htmlText, { sourceCodeLocationInfo: true });
    }

    const cache = htmlAstCache.get(meta);
    if (cache && cache.version === meta.version) {
        return cache.ast;
    }

    const ast = parseFragment(htmlText, { sourceCodeLocationInfo: true });
    htmlAstCache.put(meta, { version: meta.version, ast });
    return ast;
}

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

export const SPACE = '\u0020';

export function getAttrValueStart(
    attr: Attribute,
    location: { startOffset: number; endOffset: number },
    htmlText: string,
): number | undefined {
    const realAttrText = htmlText.slice(location.startOffset, location.endOffset);
    const guessedAttrText = guessAttrText(attr, '"');
    if (realAttrText.length === guessedAttrText.length) {
        if (isSame(guessedAttrText, realAttrText) || isSame(guessAttrText(attr, "'"), realAttrText)) {
            return location.startOffset + attr.name.length + '="'.length + '"'.length - 1; // base zero
        } else {
            throw new Error('getAttrValueStart(): Impossible here.');
        }
    } else if (realAttrText.length === attr.name.length) {
        // <span disabled></span>
        return undefined;
    }
    const v = realAttrText.lastIndexOf(attr.value);
    return v >= 0 ? location.startOffset + v : undefined;

    function guessAttrText(attr: Attribute, quote: string): string {
        return `${attr.name}=${quote}${attr.value}${quote}`;
    }

    /**
     * 由于属性名字经过 parse5 处理后都变成小写了，而原来 html 中可能有大写的。
     * 所以要统一为小写比较。
     */
    function isSame(t1: string | undefined, t2: string | undefined) {
        return t1?.toLowerCase() === t2?.toLocaleLowerCase();
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
function getTextInside(
    htmlText: string,
    cursor: Cursor,
    leftMarker: string,
    rightMarker: string,
): CursorTextSpan | undefined {
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

export function ensureInputValid(htmlText: string, cursor: Cursor) {
    if (cursor.at < 0 || cursor.at > htmlText.length) {
        throw new Error('"cursorAt" is invalid: ' + JSON.stringify(cursor) + ', htmlText: ' + htmlText);
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
export function canCompletionHtmlAttr(tagTextBeforeCursor: string): boolean {
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

const htmlTagNameSet = new Set([
    'a',
    'abbr',
    'address',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'bdi',
    'bdo',
    'blockquote',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'cite',
    'code',
    'col',
    'colgroup',
    'data',
    'datalist',
    'dd',
    'del',
    'details',
    'dfn',
    'dialog',
    'div',
    'dl',
    'dt',
    'em',
    'embed',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'i',
    'iframe',
    'img',
    'input',
    'ins',
    'kbd',
    'label',
    'legend',
    'li',
    'link',
    'main',
    'map',
    'mark',
    'meta',
    'meter',
    'nav',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'param',
    'picture',
    'pre',
    'progress',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'script',
    'section',
    'select',
    'small',
    'source',
    'span',
    'strong',
    'style',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'template',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
]);
export function isHtmlTagName(name: string): boolean {
    return htmlTagNameSet.has(name.toLowerCase());
}
