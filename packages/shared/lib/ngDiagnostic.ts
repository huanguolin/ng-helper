import type { NgAttrName, Location as NgLocation } from '@ng-helper/ng-parser/src/types';

import { getAttrLocations, isElement, isTextNode } from './cursorAt';
import {
    getAttrValueStart,
    parseHtmlFragmentWithCache,
    type ChildNode,
    type Element,
    type HtmlAstCacheMeta,
} from './html';
import { ngParse } from './ngParse';
import { isComponentTagName, isNgBuiltinExpressionDirective } from './ngUtils';

export interface NgDiagnostic extends NgLocation {
    message: string;
}

export interface NgDiagnosticAdditionalInfo {
    /**
     * 组件表达式属性值映射
     *
     * 键：组件名称
     * 值：表达式属性值列表
     *
     * 名字都是 kebabCase，比如 `my-component`
     */
    componentExpressionAttrMap: Record<string, string[]>;
    /**
     * 指令表达式属性值映射
     *
     * 键：指令名称
     * 值：表达式属性值列表
     *
     * 名字都是 kebabCase，比如 `my-directive`
     */
    directiveExpressionAttrMap: Record<string, string[]>;
}

const templateRegex = /\{\{([^}]*?)\}\}/g;

export function getNgDiagnosticResult(
    htmlText: string,
    options?: {
        additionalInfo?: NgDiagnosticAdditionalInfo;
        meta?: HtmlAstCacheMeta;
    },
): NgDiagnostic[] {
    const { additionalInfo, meta } = options ?? {};

    const htmlAst = parseHtmlFragmentWithCache(htmlText, meta);

    const diagnostics: NgDiagnostic[] = [];

    for (const childNode of htmlAst.childNodes) {
        traverseNode(childNode);
    }

    return diagnostics;

    function traverseNode(node: ChildNode) {
        if (isElement(node)) {
            const element = node;
            const tagName = element.tagName;

            if (isComponentTagName(tagName)) {
                checkComponentAttributes(element);
            } else {
                checkDirectiveAttributes(element);
            }

            // 递归遍历子节点
            if (element.childNodes) {
                for (const childNode of element.childNodes) {
                    traverseNode(childNode);
                }
            }
        } else if (isTextNode(node)) {
            checkNgTemplate(
                // 这里如果传 node.text，里面 CRLF 都被替换为 LF，导致错误报告的位置有偏差。
                // 所以这里要用位置把原始的文本拿到，传递给下面。（PS. attr.value 好像没问题）
                htmlText.slice(node.sourceCodeLocation!.startOffset, node.sourceCodeLocation!.endOffset),
                node.sourceCodeLocation!.startOffset,
            );
        }
    }

    function checkComponentAttributes(element: Element) {
        const attrLocations = getAttrLocations(element);
        const componentExprAttrNames = new Set((additionalInfo?.componentExpressionAttrMap ?? {})[element.tagName]);
        const directiveExprAttrNames = new Set<string>();

        if (additionalInfo && Object.keys(additionalInfo.directiveExpressionAttrMap).length) {
            for (const attr of element.attrs) {
                const names = additionalInfo.directiveExpressionAttrMap[attr.name];
                if (names) {
                    for (const name of names) {
                        directiveExprAttrNames.add(name);
                    }
                }
            }
        }

        for (const attr of element.attrs) {
            const { start: startOffset, end: endOffset } = attrLocations[attr.name];
            const attrValueStart = getAttrValueStart(attr, { startOffset, endOffset }, htmlText) ?? 0;
            if (isNgBuiltinExpressionDirective(attr.name)) {
                validateNgExpression(attr.value, attrValueStart, attr.name);
            } else if (hasNgTemplate(attr.value)) {
                checkNgTemplate(attr.value, attrValueStart, attr.name);
            } else if (componentExprAttrNames.has(attr.name) || directiveExprAttrNames.has(attr.name)) {
                validateNgExpression(attr.value, attrValueStart, attr.name);
            }
        }
    }

    function checkDirectiveAttributes(element: Element) {
        const attrLocations = getAttrLocations(element);
        const directiveExprAttrNames = new Set<string>();

        if (additionalInfo && Object.keys(additionalInfo.directiveExpressionAttrMap).length) {
            for (const attr of element.attrs) {
                const names = additionalInfo.directiveExpressionAttrMap[attr.name];
                if (names) {
                    for (const name of names) {
                        directiveExprAttrNames.add(name);
                    }
                }
            }
        }

        for (const attr of element.attrs) {
            const { start: startOffset, end: endOffset } = attrLocations[attr.name];
            const attrValueStart = getAttrValueStart(attr, { startOffset, endOffset }, htmlText) ?? 0;
            if (isNgBuiltinExpressionDirective(attr.name)) {
                validateNgExpression(attr.value, attrValueStart, attr.name);
            } else if (hasNgTemplate(attr.value)) {
                checkNgTemplate(attr.value, attrValueStart, attr.name);
            } else if (directiveExprAttrNames.has(attr.name)) {
                validateNgExpression(attr.value, attrValueStart, attr.name);
            }
        }
    }

    function checkNgTemplate(text: string, offsetAt: number, attrName?: string) {
        if (text && hasNgTemplate(text)) {
            // 查找所有模板表达式 {{expression}}
            let match;

            templateRegex.lastIndex = 0;
            while ((match = templateRegex.exec(text)) !== null) {
                const expressionStr = match[1];
                const expressionStart = match.index + '{{'.length;
                validateNgExpression(expressionStr, offsetAt + expressionStart, attrName);
            }
        }
    }

    function validateNgExpression(text: string, baseStart: number, attrName?: string) {
        if (attrName === 'ng-options') {
            // 目前不处理
            return;
        }

        let ngAttrName: NgAttrName | undefined;
        if (attrName === 'ng-controller') {
            ngAttrName = 'ng-controller';
        } else if (attrName === 'ng-repeat' || attrName === 'ng-repeat-start') {
            ngAttrName = 'ng-repeat';
        }

        const result = ngParse(text, ngAttrName);
        for (const error of result.errors) {
            diagnostics.push({
                message: error.message,
                start: baseStart + error.start,
                end: baseStart + error.end,
            });
        }
    }
}

function hasNgTemplate(text: string) {
    const templateStart = text.indexOf('{{');
    const templateEnd = text.indexOf('}}');
    return templateStart !== -1 && templateEnd !== -1 && templateStart < templateEnd;
}
