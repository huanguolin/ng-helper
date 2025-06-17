import { parseHtmlFragmentWithCache } from '@ng-helper/shared/lib/html';
import type { Diagnostic, DiagnosticCollection, TextDocument } from 'vscode';

export function validate(diagnosticCollection: DiagnosticCollection, document: TextDocument) {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const htmlAst = parseHtmlFragmentWithCache(text, { filePath: document.uri.toString(), version: document.version });
    // TODO：
    // 1. 遍历语法树
    // 2. 找需要检查的节点
    //  2.1 如果是元素节点，需要判断是否是组件
    //      2.1.1 是，找它的非 string 类型属性，和有模版表达式的 string 属性
    //      2.1.2 否，找属性是否有指令，若是，找它的非 string 类型属性
    //  2.2 如果是文本节点，寻找模版表达式
    // 3. 使用 ngParse 诊断

    // Set diagnostics
    diagnosticCollection.set(document.uri, diagnostics);
}
