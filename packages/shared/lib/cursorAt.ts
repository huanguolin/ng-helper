import type { NgAttrName } from '@ng-helper/ng-parser/src/types';
import type { Attribute, Location } from 'parse5/dist/common/token';
import type {
    ChildNode,
    DocumentFragment,
    Element,
    Node,
    ParentNode,
    TextNode,
} from 'parse5/dist/tree-adapters/default';

import {
    ensureInputValid,
    getAttrValueStart,
    getTextInTemplate,
    parseHtmlFragmentWithCache,
    type Cursor,
    type HtmlAstCacheMeta,
} from './html';

export interface SimpleLocation {
    start: number;
    end: number;
}

export type CursorAtType = 'tagName' | 'attrName' | 'attrValue' | 'template' | 'text' | 'startTag' | 'endTag';

export interface CursorAtContext {
    /**
     * 具有上下文能力的指令名字。
     */
    kind: NgAttrName;
    /**
     * 对应的属性值。
     */
    value: string;
    /**
     * 起始位置。
     */
    startAt: number;
}

interface TagInfo {
    /**
     * 可用于查组件名字。
     */
    tagName: string;
    /**
     * 可用于查指令名字。
     */
    attrNames: string[];
    /**
     * 可用于查 transclude 的情况。
     */
    parentTagName?: string;
}

/**
 * 光标在 tag 名字上。
 */
export interface CursorAtTagNameInfo extends TagInfo {
    type: 'tagName';
}

/**
 * 光标在属性名字上。
 */
export interface CursorAtAttrNameInfo extends TagInfo {
    type: 'attrName';
    cursorAtAttrName: string;
    /**
     * 顺序是由近及远。即：排在第一的可能是父节点上的，后面的则是祖父或者曾祖父节点的。
     */
    context: CursorAtContext[];
    /**
     * 目前只用于指令的属性自动补全。
     */
    attrLocations: Record<string, SimpleLocation>;
}

/**
 * 光标在属性值上, 且不含属性值有模版的情况(比如: ng-url="https://example.com?id={{id}}")。
 */
export interface CursorAtAttrValueInfo extends TagInfo {
    type: 'attrValue';
    attrValue: string;
    /**
     * 有时候需要这个，比如 ng-repeat/ng-controller
     */
    attrName: string;
    /**
     * 顺序是由近及远。即：排在第一的可能是父节点上的，后面的则是祖父或者曾祖父节点的。
     */
    context: CursorAtContext[];
    /**
     * 相对于 attrValue 的开始位置的 cursorAt。
     */
    relativeCursorAt: number;
}

/**
 * 光标在模版中({{template}}), 包括属性值有模版的情况(比如: ng-url="https://example.com?id={{id}}")。
 */
export interface CursorAtTemplateInfo {
    type: 'template';
    template: string;
    /**
     * 顺序是由近及远。即：排在第一的可能是父节点上的，后面的可能是祖父或者曾祖父节点的。
     */
    context: CursorAtContext[];
    /**
     * 相对于 template 的开始位置的 cursorAt。
     */
    relativeCursorAt: number;
}

/**
 * 光标在 text node 中但不在 template 中。
 * 这个可用于组件名自动补全。
 */
export interface CursorAtTextInfo {
    type: 'text';
    parentTagName?: string;
    /**
     * transclude 需要。
     */
    siblingTagNames: string[];
    /**
     * 顺序是由近及远。即：排在第一的可能是父节点上的，后面的可能是祖父或者曾祖父节点的。
     */
    context: CursorAtContext[];
}

/**
 * 光标在 startTag 的范围内(注意：没有 endTag 的情况也算在 startTag), 但没有在 tag 名字，或者属性名/属性值上。
 * 这个可用于属性名自动补全。
 */
export interface CursorAtStartTagInfo extends TagInfo, SimpleLocation {
    type: 'startTag';
    /**
     * 目前只用于指令的属性自动补全。
     */
    attrLocations: Record<string, SimpleLocation>;
    /**
     * 顺序是由近及远。即：排在第一的可能是父节点上的，后面的可能是祖父或者曾祖父节点的。
     */
    context: CursorAtContext[];
}

/**
 * 光标在 endTag 内(首先必须要有 endTag 才行)。
 * 这个可用于排除光标在 endTag 内。
 */
export interface CursorAtEndTagInfo extends TagInfo {
    type: 'endTag';
}

export type CursorAtInfo =
    | CursorAtTagNameInfo
    | CursorAtAttrNameInfo
    | CursorAtAttrValueInfo
    | CursorAtTemplateInfo
    | CursorAtTextInfo
    | CursorAtStartTagInfo
    | CursorAtEndTagInfo;

export function cursorAt(at: number, isHover = true): Cursor {
    return { at, isHover };
}

export function getCursorAtInfo(htmlText: string, cursor: Cursor, meta?: HtmlAstCacheMeta): CursorAtInfo {
    ensureInputValid(htmlText, cursor);

    const cursorAt = cursor.at - (cursor.isHover ? 0 : 1);

    const htmlFragment = parseHtmlFragmentWithCache(htmlText, meta);
    const targetNode = findCursorAtNode(htmlFragment, cursorAt)!;
    if (!targetNode) {
        // 找不到节点时，可以认为光标在 text 节点上, 可以简化 getCursorAtInfo(） 的使用。
        return {
            type: 'text',
            siblingTagNames: [],
            context: [],
        };
    }

    // 这种查找方式涵盖了模版在 textNode 和 在 attrValue 的情况。
    const template = getTextInTemplate(htmlText, cursor);
    if (template) {
        return {
            type: 'template',
            template: template.text,
            context: targetNode ? getContext(targetNode, htmlText) : [],
            relativeCursorAt: cursorAt - template.start,
        };
    }

    if (isTextNode(targetNode)) {
        const p = isElement(targetNode.parentNode) ? targetNode.parentNode : undefined;
        return {
            type: 'text',
            parentTagName: p?.tagName,
            siblingTagNames: p ? p.childNodes.filter(isElement).map((x) => x.tagName) : [],
            context: p ? getContext(p, htmlText) : [],
        };
    }

    const element = targetNode;
    if (element.sourceCodeLocation!.attrs) {
        const attrWithLocation = getCursorAtAttr(element.attrs, element.sourceCodeLocation!.attrs, cursorAt);
        if (attrWithLocation) {
            const [attr, attrLocation] = attrWithLocation;

            // attrName
            if (cursorAt < attrLocation.startOffset + attr.name.length) {
                return {
                    type: 'attrName',
                    cursorAtAttrName: attr.name,
                    context: getContext(element, htmlText),
                    attrLocations: getAttrLocations(element),
                    ...getTagInfo(element),
                };
            }

            // attrValue
            const attrValueStart = getAttrValueStart(attr, attrLocation, htmlText);
            if (isCursorAtAttrValue(attr, attrValueStart, cursorAt)) {
                // 这里无需考虑模版在 attrValue 的情况，前面已经统一处理。
                return {
                    type: 'attrValue',
                    attrName: attr.name,
                    attrValue: attr.value,
                    context: getContext(targetNode, htmlText),
                    relativeCursorAt: cursorAt - attrValueStart!,
                    ...getTagInfo(element),
                };
            }
        }
    }

    if (isCursorAtTagName(element, cursorAt)) {
        return {
            type: 'tagName',
            ...getTagInfo(element),
        };
    }

    if (isCursorAtEndTag(element, cursorAt)) {
        return {
            type: 'endTag',
            ...getTagInfo(element),
        };
    }

    return getStartTagInfo(element, htmlText);
}

function getStartTagInfo(element: Element, htmlText: string): CursorAtStartTagInfo {
    return {
        type: 'startTag',
        start: element.sourceCodeLocation!.startOffset,
        end: (element.sourceCodeLocation!.startTag ?? element.sourceCodeLocation!).endOffset,
        context: getContext(element, htmlText),
        attrLocations: getAttrLocations(element),
        ...getTagInfo(element),
    };
}

export function getAttrLocations(element: Element) {
    const attrLocations: Record<string, SimpleLocation> = {};
    // 注意：
    // 有一些虚拟节点，比如 tboday, theader 之类的 element.sourceCodeLocation 为 null
    if (element.sourceCodeLocation?.attrs) {
        for (const [key, value] of Object.entries(element.sourceCodeLocation.attrs)) {
            attrLocations[key] = {
                start: value.startOffset,
                end: value.endOffset,
            };
        }
    }
    return attrLocations;
}

function isCursorAtEndTag(element: Element, cursorAt: number): boolean {
    const endTagLocation = element.sourceCodeLocation!.endTag;
    return !!endTagLocation && cursorAt >= endTagLocation.startOffset && cursorAt < endTagLocation.endOffset;
}

function isCursorAtTagName(element: Element, cursorAt: number): boolean {
    const tagLocation = element.sourceCodeLocation!;
    const endTagLocation = element.sourceCodeLocation!.endTag;

    const atStartTagName =
        cursorAt >= tagLocation.startOffset + '<'.length &&
        cursorAt < tagLocation.startOffset + '<'.length + element.tagName.length;
    const atEndTagName =
        endTagLocation !== undefined &&
        cursorAt >= endTagLocation.startOffset + '</'.length &&
        cursorAt < endTagLocation.endOffset - '>'.length;

    return atStartTagName || atEndTagName;
}

function isCursorAtAttrValue(attr: Attribute, attrValueStart: number | undefined, cursorAt: number): boolean {
    return (
        typeof attrValueStart === 'number' &&
        cursorAt >= attrValueStart &&
        cursorAt < attrValueStart + attr.value.length
    );
}

function getCursorAtAttr(
    attrs: Attribute[],
    attrLocations: Record<string, Location>,
    cursorAt: number,
): undefined | [Attribute, Location] {
    for (const attr of attrs) {
        const location = attrLocations[attr.name];
        if (cursorAt >= location.startOffset && cursorAt < location.endOffset) {
            return [attr, location];
        }
    }
}

function getTagInfo(element: Element): TagInfo {
    return {
        tagName: element.tagName,
        attrNames: element.attrs.map((x) => x.name),
        parentTagName: isElement(element.parentNode) ? element.parentNode.tagName : undefined,
    };
}

const contextNgAttrNames = ['ng-repeat', 'ng-controller'];
function getContext(node: TextNode | Element, htmlText: string): CursorAtContext[] {
    const ctxs: CursorAtContext[] = [];
    pushCtx(node);
    return ctxs;

    function pushCtx(node: TextNode | Element | ParentNode | null) {
        if (!node) {
            return;
        }

        if (isElement(node)) {
            const attrLocationMap = node.sourceCodeLocation!.attrs!;
            const ctxNgAttrs = node.attrs
                .filter((x) => contextNgAttrNames.includes(x.name))
                .map(
                    (x) =>
                        ({
                            kind: x.name,
                            value: x.value,
                            startAt: getAttrValueStart(x, attrLocationMap[x.name], htmlText)!,
                        }) as CursorAtContext,
                );
            ctxs.push(...ctxNgAttrs);
        }

        pushCtx((node as { parentNode: ParentNode | null }).parentNode);
    }
}

function findCursorAtNode(htmlFragment: DocumentFragment, cursorAt: number): TextNode | Element | undefined {
    for (const node of htmlFragment.childNodes) {
        const target = visit(node);
        if (target) {
            return target;
        }
    }

    function visit(node: ChildNode): TextNode | Element | undefined {
        if (isIgnoredNode(node)) {
            return;
        }

        const { startOffset, endOffset } = node.sourceCodeLocation!;
        if (cursorAt >= startOffset && cursorAt < endOffset) {
            if (isElement(node)) {
                for (const childNode of node.childNodes) {
                    const target = visit(childNode);
                    if (target) {
                        return target;
                    }
                }
                return node;
            } else if (isTextNode(node)) {
                return node;
            }
        }
    }
}

export function isTextNode(node: ChildNode): node is TextNode {
    return node.nodeName === '#text';
}

const notElementNodeNames = ['#document', '#document-fragment', '#documentType', '#comment', 'template', '#text'];
export function isElement(node?: Node | null): node is Element {
    return !!node && !notElementNodeNames.includes(node.nodeName);
}

const ignoredNodeNames = ['#comment', '#documentType', 'template'];
/**
 * Template, CommentNode, DocumentType 直接忽略，只考虑 TextNode, Element.
 * type ChildNode = Element | Template | CommentNode | TextNode | DocumentType;
 */
function isIgnoredNode(node: ChildNode): boolean {
    return ignoredNodeNames.includes(node.nodeName);
}
