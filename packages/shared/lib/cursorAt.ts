import { parseFragment } from 'parse5';
import type { Attribute, Location } from 'parse5/dist/common/token';
import type {
    ChildNode,
    DocumentFragment,
    Element,
    Node,
    ParentNode,
    TextNode,
} from 'parse5/dist/tree-adapters/default';

import { ensureInputValid, getAttrValueStart, getTextInTemplate, type Cursor } from './html';

export type CursorAtType = 'tagStart' | 'tagName' | 'attrName' | 'attrValue' | 'template';

export interface CursorAtContext {
    /**
     * 具有上下文能力的指令名字。
     */
    kind: 'ng-controller' | 'ng-repeat' | 'ng-options';
    /**
     * 对应的属性值。
     */
    value: string;
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
 * 光标在 start tag 的范围内, 但没有在 tag 名字，或者属性名/属性值上。
 * 这个可用于属性名自动补全。
 */
export interface CursorAtTagInfo extends TagInfo {
    type: 'tagStart';
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
}

/**
 * 光标在属性值上, 且不含属性值有模版的情况(比如: ng-url="https://example.com?id={{id}}")。
 */
export interface CursorAtAttrValueInfo {
    type: 'attrValue';
    attrValue: string;
    /**
     * 有时候需要这个，比如 ng-repeat/ng-options/ng-controller
     */
    attrName: string;
    /**
     * 顺序是由近及远。即：排在第一的可能是父节点上的，后面的则是祖父或者曾祖父节点的。
     */
    context: CursorAtContext[];
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
}

export type CursorAtInfo =
    | CursorAtTagInfo
    | CursorAtTagNameInfo
    | CursorAtAttrNameInfo
    | CursorAtAttrValueInfo
    | CursorAtTemplateInfo;

export function getCursorAtInfo(htmlText: string, cursor: Cursor): CursorAtInfo | undefined {
    ensureInputValid(htmlText, cursor);

    const cursorAt = cursor.at - (cursor.isHover ? 0 : 1);

    const htmlFragment = parseFragment(htmlText, { sourceCodeLocationInfo: true });
    const targetNode = findCursorAtNode(htmlFragment, cursorAt);

    // 这种查找方式涵盖了模版在 textNode 和 在 attrValue 的情况。
    const template = getTextInTemplate(htmlText, cursor);
    if (template) {
        return {
            type: 'template',
            template: template.text,
            context: targetNode ? getContext(targetNode) : [],
        };
    }

    if (!targetNode || !isElement(targetNode)) {
        return;
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
                    ...getTagInfo(element),
                };
            }

            // attrValue
            if (isCursorAtAttrValue(attr, attrLocation, htmlText, cursorAt)) {
                // 这里无需考虑模版在 attrValue 的情况，前面已经统一处理。
                return {
                    type: 'attrValue',
                    attrName: attr.name,
                    attrValue: attr.value,
                    context: getContext(targetNode),
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

    if (isCursorAtTagStart(element, cursorAt)) {
        return {
            type: 'tagStart',
            ...getTagInfo(element),
        };
    }
}

function isCursorAtTagStart(element: Element, cursorAt: number): boolean {
    const startTagLocation = element.sourceCodeLocation!.startTag;
    return !!startTagLocation && cursorAt > startTagLocation.startOffset && cursorAt < startTagLocation.endOffset;
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

function isCursorAtAttrValue(attr: Attribute, location: Location, htmlText: string, cursorAt: number): boolean {
    const attrValueStart = getAttrValueStart(attr, location, htmlText);
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

const contextNgAttrNames = ['ng-repeat', 'ng-options', 'ng-controller'];
function getContext(node: TextNode | Element): CursorAtContext[] {
    const ctxs: CursorAtContext[] = [];
    pushCtx(node.parentNode);
    return ctxs;

    function pushCtx(node: ParentNode | null) {
        if (!node) {
            return;
        }

        if (isElement(node)) {
            const ctxNgAttrs = node.attrs
                .filter((x) => contextNgAttrNames.includes(x.name))
                .map((x) => ({ kind: x.name, value: x.value }) as CursorAtContext);
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
            }
        } else if (isTextNode(node)) {
            return node;
        } else {
            // 不可能到这里
        }
    }
}

function isTextNode(node: ChildNode): node is TextNode {
    return node.nodeName === '#textNode';
}

const notElementNodeNames = ['#document', '#document-fragment', '#documentType', '#comment', 'template', '#textNode'];
function isElement(node?: Node | null): node is Element {
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
