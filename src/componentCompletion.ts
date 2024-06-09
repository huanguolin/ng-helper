import { start } from 'repl';
import * as vscode from 'vscode';

export function registerComponentCompletions(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        dotCompletion(),
        ngCompletion());
}

function dotCompletion() {
    return vscode.languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                if (!isComponentHtml(document)) {
                    return undefined;
                }

                // const line = document.lineAt(position).text;
                // const linePrefix = line.slice(0, position.character);
                // if (!linePrefix.endsWith('{{')) {
                // 	return undefined;
                // }

                // remove .html add .ts
                const file = document.fileName.slice(0, -5) + '.ts';

                return activateTsServer(file)
                    .then(() => {
                        return vscode.commands
                            .executeCommand("typescript.tsserverRequest",
                                "completionInfo",
                                {
                                    file,
                                    line: 37,
                                    offset: 18,
                                    triggerCharacter: '.',
                                }).then((list: any) => {
                                    console.log('completionInfo: ', list);
                                    // return list;

                                    type CompletionItemInfo = {
                                        name: string;
                                        kindModifiers: string;
                                        kind: string;
                                    };

                                    return list.body.entries
                                        .filter((x: CompletionItemInfo) =>
                                            !x.kindModifiers.includes('private') &&
                                            ['method', 'property'].includes(x.kind) &&
                                            !x.name.startsWith('$'))
                                        .map((x: CompletionItemInfo) =>
                                            new vscode.CompletionItem(x.name,
                                                x.kind === 'method'
                                                    ? vscode.CompletionItemKind.Method
                                                    : vscode.CompletionItemKind.Field));
                                }, (err) => {
                                    console.log('completionInfo error: ', err);
                                    return;
                                });
                    });

            }
        },
        '.',
    );
}

function ngCompletion() {
    return vscode.languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                if (!isComponentHtml(document)) {
                    return undefined;
                }

                return getNgDirectiveList()
                    .map(x => new vscode.CompletionItem(x));
            }
        },
    );
}

function isComponentHtml(document: vscode.TextDocument) {
    return document.fileName.endsWith('.component.html');
}

function getNgDirectiveList() {
    return [
        'ng-click',
        'ng-if',
        'ng-model',
        'ng-class',
        'ng-disabled',
        'ng-show',
        'ng-repeat',
        'ng-init',
        'ng-controller',
        'ng-options',
        'ng-change',
        'ng-pattern',
        'ng-bind',
        'ng-required',
        'ng-maxlength',
        'ng-hide',
        'ng-style',
        'ng-list',
        'ng-dblclick',
        'ng-submit',
        'ng-src',
        'ng-href',
        'ng-checked',
        'ng-include',
        'ng-cloak',
        'ng-transclude',
        'ng-app',
        'ng-value',
        'ng-blur',
        'ng-keypress',
        'ng-selected',
        'ng-readonly',
        'ng-keydown',
        'ng-form',
        'ng-mouseover',
        'ng-mouseleave',
        'ng-mouseenter',
    ];
}

function activateTsServer(tsFilePath: string) {
    return vscode.workspace.openTextDocument(tsFilePath).then(doc => {
        doc.getText();
        return vscode.languages.setTextDocumentLanguage(doc, 'typescript');
    });
}