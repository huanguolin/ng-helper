import { languages, workspace, type ExtensionContext, type TextDocument } from 'vscode';

import { EXT_NAME } from '../../constants';

import { validate } from './validate';

export function registerDiagnostic(context: ExtensionContext, _port: number): void {
    const diagnosticCollection = languages.createDiagnosticCollection(EXT_NAME);
    context.subscriptions.push(diagnosticCollection);

    // 初始验证所有打开的文档
    workspace.textDocuments.forEach(validateDocument);

    // 监听文档变化
    context.subscriptions.push(
        workspace.onDidChangeTextDocument((event) => {
            validateDocument(event.document);
        }),
    );

    // 监听文档打开
    context.subscriptions.push(workspace.onDidOpenTextDocument(validateDocument));

    function validateDocument(document: TextDocument) {
        if (document.languageId === 'html') {
            validate(diagnosticCollection, document);
        }
    }
}
