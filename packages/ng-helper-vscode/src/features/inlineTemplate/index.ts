import {
    Uri,
    commands,
    languages,
    workspace,
    type CompletionList,
    type Definition,
    type ExtensionContext,
    type Hover,
    type Position,
    type TextDocument,
} from 'vscode';

import { getOriginalFileName } from '../utils';

const virtualDocumentContents = new Map<string, string>();

export function supportInlineTemplate(context: ExtensionContext) {
    registerVirtualDocumentProvider(context);

    requestForwardHover(context);
    requestForwardDefinition(context);
    requestForwardCompletion(context);
}

function requestForwardHover(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerHoverProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideHover(document, position) {
                    const vDocText = getRelateTemplate(document, position);
                    if (!vDocText) {
                        return;
                    }

                    const vDocUri = prepareVirtualDocument(document, vDocText);
                    const info = await commands.executeCommand<Hover[]>('vscode.executeHoverProvider', vDocUri, position);
                    if (info && info.length) {
                        return info[0];
                    }
                },
            },
        ),
    );
}

function requestForwardDefinition(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerDefinitionProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideDefinition(document, position) {
                    const vDocText = getRelateTemplate(document, position);
                    if (!vDocText) {
                        return;
                    }

                    const vDocUri = prepareVirtualDocument(document, vDocText);
                    const info = await commands.executeCommand<Definition | undefined>('vscode.executeDefinitionProvider', vDocUri, position);
                    return info;
                },
            },
        ),
    );
}

function requestForwardCompletion(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerCompletionItemProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideCompletionItems(document, position, _, ctx) {
                    const vDocText = getRelateTemplate(document, position);
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
            '.', // for ng data binding
            '<', // for html tag start
            ' ', // for html tag attr
        ),
    );
}

function registerVirtualDocumentProvider(context: ExtensionContext) {
    context.subscriptions.push(
        workspace.registerTextDocumentContentProvider('embedded-content', {
            provideTextDocumentContent: (uri) => {
                const originalUri = getOriginalFileName(uri.path);
                const decodedUri = decodeURIComponent(originalUri);
                const docText = virtualDocumentContents.get(decodedUri);
                return docText || '';
            },
        }),
    );
}

function prepareVirtualDocument(document: TextDocument, vDocText: string) {
    const originalUri = document.uri.toString(true);
    virtualDocumentContents.set(originalUri, vDocText);
    const vDocUriStr = `embedded-content://html/${encodeURIComponent(originalUri)}.html`;
    const vDocUri = Uri.parse(vDocUriStr);
    return vDocUri;
}

const NG_TPL_REG = /\btemplate\s*:\s*(['"`])[\s\S]*?(?!\\)(\1)/g;
function getRelateTemplate(document: TextDocument, position: Position): string | undefined {
    const offsetAt = document.offsetAt(position);
    const text = document.getText();
    let match: RegExpExecArray | null;
    NG_TPL_REG.lastIndex = 0;
    while ((match = NG_TPL_REG.exec(text)) !== null) {
        const index = match.index;
        const matchStr = match[0];
        const strBegin = index + matchStr.indexOf(match[1]) + 1;
        const strEnd = index + matchStr.lastIndexOf(match[1]);
        if (offsetAt < strBegin) {
            return;
        } else if (offsetAt < strEnd) {
            return getVirtualDocText(text, strBegin, strEnd);
        }
    }
}

function getVirtualDocText(text: string, start: number, end: number): string {
    const targetContent = text.slice(start, end);
    let content = text
        .split('\n')
        .map((line) => {
            return ' '.repeat(line.length);
        })
        .join('\n');
    content = content.slice(0, start) + targetContent + content.slice(end);
    return content;
}
