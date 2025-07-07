import {
    Uri,
    commands,
    languages,
    workspace,
    type CompletionList,
    type Definition,
    type Hover,
    type SignatureHelp,
    type TextDocument,
} from 'vscode';

import type { NgContext } from '../../ngContext';
import { triggerChars as completionTriggerChars } from '../completion';
import { htmlSemanticProvider, legend } from '../semantic';
import { triggerChars as signatureHelpTriggerChars } from '../signatureHelp';
import { getOriginalFileName } from '../utils';

import { resolveVirtualDocText } from './utils';

type VirtualDocumentInfo = {
    timestamp: number;
    documentText: string;
};

const EMBEDDED_CONTENT_FLAG = 'embedded-content';
const MAX_COUNT = 5;
const EXPIRE_TIME = 5 * 60 * 1000;
const virtualDocumentContents = new Map<string, VirtualDocumentInfo>();

export function supportInlineHtml(ngContext: NgContext) {
    registerVirtualDocumentProvider(ngContext);

    providerSemantic(ngContext);

    requestForwardHover(ngContext);
    requestForwardDefinition(ngContext);
    requestForwardCompletion(ngContext);
    requestForwardSignatureHelp(ngContext);
}

function providerSemantic(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerDocumentSemanticTokensProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideDocumentSemanticTokens(document, token) {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const vDocText = resolveVirtualDocText(document);
                    if (!vDocText) {
                        return;
                    }

                    return await htmlSemanticProvider({ document, ngContext, token });
                },
            },
            legend,
        ),
    );
}

function requestForwardHover(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerHoverProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideHover(document, position) {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const vDocText = resolveVirtualDocText(document, position);
                    if (!vDocText) {
                        return;
                    }

                    const vDocUri = prepareVirtualDocument(document, vDocText);
                    const info = await commands.executeCommand<Hover[]>(
                        'vscode.executeHoverProvider',
                        vDocUri,
                        position,
                    );
                    if (info && info.length) {
                        return info[0];
                    }
                },
            },
        ),
    );
}

function requestForwardDefinition(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerDefinitionProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideDefinition(document, position) {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const vDocText = resolveVirtualDocText(document, position);
                    if (!vDocText) {
                        return;
                    }

                    const vDocUri = prepareVirtualDocument(document, vDocText);
                    const info = await commands.executeCommand<Definition | undefined>(
                        'vscode.executeDefinitionProvider',
                        vDocUri,
                        position,
                    );
                    return info;
                },
            },
        ),
    );
}

function requestForwardCompletion(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerCompletionItemProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideCompletionItems(document, position, _, ctx) {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const vDocText = resolveVirtualDocText(document, position);
                    if (!vDocText) {
                        return;
                    }

                    const vDocUri = prepareVirtualDocument(document, vDocText);
                    const info = await commands.executeCommand<CompletionList>(
                        'vscode.executeCompletionItemProvider',
                        vDocUri,
                        position,
                        ctx.triggerCharacter,
                    );
                    return info;
                },
            },
            ...completionTriggerChars,
        ),
    );
}

function requestForwardSignatureHelp(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerSignatureHelpProvider(
            [
                // 这个只有 ts 才能起作用，js 没有类型信息
                { scheme: 'file', language: 'typescript' },
            ],
            {
                async provideSignatureHelp(document, position, _, ctx) {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const vDocText = resolveVirtualDocText(document, position);
                    if (!vDocText) {
                        return;
                    }

                    const vDocUri = prepareVirtualDocument(document, vDocText);
                    const info = await commands.executeCommand<SignatureHelp>(
                        'vscode.executeSignatureHelpProvider',
                        vDocUri,
                        position,
                        ctx.triggerCharacter,
                    );
                    return info;
                },
            },
            ...signatureHelpTriggerChars,
        ),
    );
}

function registerVirtualDocumentProvider(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        workspace.registerTextDocumentContentProvider(EMBEDDED_CONTENT_FLAG, {
            provideTextDocumentContent: (uri) => {
                const originalUri = getOriginalFileName(uri.path);
                const decodedUri = decodeURIComponent(originalUri);
                const docText = virtualDocumentContents.get(decodedUri);
                return docText?.documentText || '';
            },
        }),
    );
}

function prepareVirtualDocument(document: TextDocument, vDocText: string) {
    const originalUri = document.uri.toString(true);
    virtualDocumentContents.set(originalUri, {
        timestamp: Date.now(),
        documentText: vDocText,
    });
    gc();
    const vDocUriStr = `${EMBEDDED_CONTENT_FLAG}://html/${encodeURIComponent(originalUri)}.html`;
    const vDocUri = Uri.parse(vDocUriStr);
    return vDocUri;
}

function gc() {
    if (virtualDocumentContents.size > MAX_COUNT) {
        const now = Date.now();
        for (const [uri, info] of virtualDocumentContents.entries()) {
            if (now - info.timestamp > EXPIRE_TIME) {
                virtualDocumentContents.delete(uri);
            }
        }
    }
}
