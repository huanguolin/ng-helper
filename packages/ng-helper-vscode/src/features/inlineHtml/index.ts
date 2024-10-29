import {
    Range,
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

import { htmlSemanticProvider, legend } from '../semantic';
import { getOriginalFileName } from '../utils';

type VirtualDocumentInfo = {
    timestamp: number;
    documentText: string;
};

const NG_TPL_REG = /\btemplate\s*:\s*(['"`])[\s\S]*?(?!\\)(\1)/g;
const MAX_COUNT = 5;
const EXPIRE_TIME = 5 * 60 * 1000;
const virtualDocumentContents = new Map<string, VirtualDocumentInfo>();

export function supportInlineHtml(context: ExtensionContext, port: number) {
    registerVirtualDocumentProvider(context);

    providerSemantic(context, port);

    requestForwardHover(context);
    requestForwardDefinition(context);
    requestForwardCompletion(context);
}

function providerSemantic(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerDocumentSemanticTokensProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideDocumentSemanticTokens(document, token) {
                    const vDocText = resolveVirtualDocText(document);
                    if (!vDocText) {
                        return;
                    }

                    return await htmlSemanticProvider({ document, port, token, noServiceRunningCheck: true });
                },
            },
            legend,
        ),
    );
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

function requestForwardDefinition(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerDefinitionProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideDefinition(document, position) {
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

function requestForwardCompletion(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerCompletionItemProvider(
            [
                { scheme: 'file', language: 'typescript' },
                { scheme: 'file', language: 'javascript' },
            ],
            {
                async provideCompletionItems(document, position, _, ctx) {
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
    const vDocUriStr = `embedded-content://html/${encodeURIComponent(originalUri)}.html`;
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

function resolveVirtualDocText(document: TextDocument, position?: Position): string | undefined {
    const text = document.getText();

    const ranges: Range[] = [];

    let match: RegExpExecArray | null;
    NG_TPL_REG.lastIndex = 0;
    while ((match = NG_TPL_REG.exec(text)) !== null) {
        const index = match.index;
        const matchStr = match[0];
        const strBegin = index + matchStr.indexOf(match[1]) + 1;
        const strEnd = index + matchStr.lastIndexOf(match[1]);
        ranges.push(new Range(document.positionAt(strBegin), document.positionAt(strEnd)));
    }

    // fix #18
    if (position) {
        const inRange = ranges.find((r) => r.contains(position));
        if (!inRange) {
            return;
        }
    }

    if (ranges.length) {
        return getVirtualDocText(document, ranges);
    }
}

function getVirtualDocText(document: TextDocument, ranges: Range[]): string {
    const text = document.getText();
    let content = text
        .split('\n')
        .map((line) => {
            return ' '.repeat(line.length);
        })
        .join('\n');

    for (const range of ranges) {
        const start = document.offsetAt(range.start);
        const end = document.offsetAt(range.end);
        const targetContent = text.slice(start, end);
        content = content.slice(0, start) + targetContent + content.slice(end);
    }
    return content;
}
