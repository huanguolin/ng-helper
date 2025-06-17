import type { NgAttrName } from '@ng-helper/ng-parser/src/types';
import { parseHtmlFragmentWithCache, type ChildNode, type Element, type TextNode } from '@ng-helper/shared/lib/html';
import { ngParse } from '@ng-helper/shared/lib/ngParse';
import { Diagnostic, DiagnosticCollection, TextDocument, Range, DiagnosticSeverity } from 'vscode';

import { isComponentTagName, isNgUserCustomAttr } from '../utils';

export function validate(diagnosticCollection: DiagnosticCollection, document: TextDocument) {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    const htmlAst = parseHtmlFragmentWithCache(text, { filePath: document.uri.toString(), version: document.version });

    // 开始遍历
    if (htmlAst.childNodes) {
        for (const childNode of htmlAst.childNodes) {
            traverseNode(childNode);
        }
    }

    // Set diagnostics
    diagnosticCollection.set(document.uri, diagnostics);

    // 遍历语法树
    function traverseNode(node: ChildNode) {
        if (!node) {
            return;
        }

        // 如果是元素节点，需要判断是否是组件
        if (isElement(node)) {
            const element = node as Element;
            const tagName = element.tagName;

            if (isComponentTagName(tagName)) {
                // 是组件，找它的非 string 类型属性，和有模版表达式的 string 属性
                checkComponentAttributes(element);
            } else {
                // 否，找属性是否有指令，若是，找它的非 string 类型属性
                checkDirectiveAttributes(element);
            }

            // 递归遍历子节点
            if (element.childNodes) {
                for (const childNode of element.childNodes) {
                    traverseNode(childNode);
                }
            }
        } else if (isTextNode(node)) {
            // 如果是文本节点，寻找模版表达式
            const textNode = node;
            checkTextNodeTemplates(textNode);
        }
    }

    // 检查组件属性
    function checkComponentAttributes(element: Element) {
        if (!element.attrs) {
            return;
        }

        for (const attr of element.attrs) {
            // 检查非字符串类型的属性（包含Angular表达式的属性）
            if (isAngularExpressionAttribute(attr.name)) {
                validateNgExpression(attr.value, attr.name, getAttributeRange(element, attr));
            }
            // 检查字符串属性中的模板表达式
            else if (containsTemplateExpression(attr.value)) {
                validateTemplateExpressions(attr.value, getAttributeValueRange(element, attr));
            }
        }
    }

    // 检查指令属性
    function checkDirectiveAttributes(element: Element) {
        if (!element.attrs) {
            return;
        }

        for (const attr of element.attrs) {
            if (isNgUserCustomAttr(attr.name)) {
                // 如果是指令，检查其非字符串类型属性
                if (isAngularExpressionAttribute(attr.name)) {
                    validateNgExpression(attr.value, attr.name, getAttributeRange(element, attr));
                }
            }
        }
    }

    // 检查文本节点中的模板表达式
    function checkTextNodeTemplates(textNode: TextNode) {
        const nodeText = textNode.value;
        if (!nodeText) {
            return;
        }

        // 查找所有模板表达式 {{expression}}
        const templateRegex = /\{\{([^}]*)\}\}/g;
        let match;

        while ((match = templateRegex.exec(nodeText)) !== null) {
            const expression = match[1].trim();
            const expressionStart = match.index + 2; // '{{'.length
            const range = getTextNodeExpressionRange(textNode, expressionStart, expression.length);
            validateNgExpression(expression, undefined, range);
        }
    }

    // 验证模板表达式（在属性值中）
    function validateTemplateExpressions(value: string, range: Range) {
        const templateRegex = /\{\{([^}]*)\}\}/g;
        let match;

        while ((match = templateRegex.exec(value)) !== null) {
            const expression = match[1].trim();
            // 这里简化处理，实际应该计算表达式在属性值中的精确位置
            validateNgExpression(expression, undefined, range);
        }
    }

    // 使用 ngParse 诊断
    function validateNgExpression(expression: string, attrName?: string, range?: Range) {
        const expr = expression.replace('{{', '  ').replace('}}', '  ');
        if (!expr.trim()) {
            return;
        }

        const program = ngParse(expr, attrName as NgAttrName);

        // 检查解析错误
        if (program.errors && program.errors.length > 0) {
            for (const error of program.errors) {
                const diagnostic: Diagnostic = {
                    range: range || new Range(0, 0, 0, 0),
                    message: `[ng-helper] ${error.message}`,
                    severity: DiagnosticSeverity.Error,
                    source: 'ng-helper',
                };
                diagnostics.push(diagnostic);
            }
        }
    }

    // 辅助函数：判断是否是元素节点
    function isElement(node: ChildNode): node is Element {
        return (
            node.nodeName !== '#text' &&
            node.nodeName !== '#comment' &&
            node.nodeName !== '#document' &&
            node.nodeName !== '#document-fragment'
        );
    }

    // 辅助函数：判断是否是文本节点
    function isTextNode(node: ChildNode): node is TextNode {
        return node.nodeName === '#text';
    }

    // 辅助函数：判断属性是否包含Angular表达式
    function isAngularExpressionAttribute(attrName: string): boolean {
        // ng-* 属性通常包含表达式
        return (
            attrName.startsWith('ng-') ||
            (attrName.includes('-') && !attrName.startsWith('data-')) ||
            attrName.startsWith('(') || // 事件绑定
            attrName.startsWith('[')
        ); // 属性绑定
    }

    // 辅助函数：判断字符串是否包含模板表达式
    function containsTemplateExpression(value: string): boolean {
        return value.includes('{{') && value.includes('}}');
    }

    // 辅助函数：获取属性的范围
    function getAttributeRange(element: Element, attr: { name: string; value: string }): Range {
        // 简化实现，实际应该计算精确位置
        const sourceLocation = element.sourceCodeLocation;
        if (sourceLocation && sourceLocation.attrs && sourceLocation.attrs[attr.name]) {
            const attrLocation = sourceLocation.attrs[attr.name];
            const startPos = document.positionAt(attrLocation.startOffset);
            const endPos = document.positionAt(attrLocation.endOffset);
            return new Range(startPos, endPos);
        }
        return new Range(0, 0, 0, 0);
    }

    // 辅助函数：获取属性值的范围
    function getAttributeValueRange(element: Element, attr: { name: string; value: string }): Range {
        const sourceLocation = element.sourceCodeLocation;
        if (sourceLocation && sourceLocation.attrs && sourceLocation.attrs[attr.name]) {
            const attrLocation = sourceLocation.attrs[attr.name];
            // 简化实现，应该计算属性值的精确位置
            const startPos = document.positionAt(attrLocation.startOffset);
            const endPos = document.positionAt(attrLocation.endOffset);
            return new Range(startPos, endPos);
        }
        return new Range(0, 0, 0, 0);
    }

    // 辅助函数：获取文本节点表达式的范围
    function getTextNodeExpressionRange(textNode: TextNode, expressionStart: number, expressionLength: number): Range {
        const sourceLocation = textNode.sourceCodeLocation;
        if (sourceLocation) {
            const absoluteStart = sourceLocation.startOffset + expressionStart;
            const absoluteEnd = absoluteStart + expressionLength;
            const startPos = document.positionAt(absoluteStart);
            const endPos = document.positionAt(absoluteEnd);
            return new Range(startPos, endPos);
        }
        return new Range(0, 0, 0, 0);
    }
}
