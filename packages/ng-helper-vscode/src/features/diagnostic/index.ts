import { languages, workspace, type TextDocument } from 'vscode';

import { EXT_NAME } from '../../constants';
import { NgContext } from '../../ngContext';

import { validate } from './validate';

export function registerDiagnostic(ngContext: NgContext): void {
    const diagnosticCollection = languages.createDiagnosticCollection(EXT_NAME);
    ngContext.vscodeContext.subscriptions.push(diagnosticCollection);

    // 初始验证所有打开的文档
    workspace.textDocuments.forEach(validateDocument);

    // 监听文档变化
    ngContext.vscodeContext.subscriptions.push(
        workspace.onDidChangeTextDocument((event) => {
            validateDocument(event.document);
        }),
    );

    // 监听文档打开
    ngContext.vscodeContext.subscriptions.push(workspace.onDidOpenTextDocument(validateDocument));

    function validateDocument(document: TextDocument) {
        if (ngContext.isNgProjectDocument(document)) {
            void validate(ngContext, diagnosticCollection, document);
        }
    }
}
