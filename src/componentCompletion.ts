import * as vscode from 'vscode';

export function registerComponentCompletions(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        bracketCompletion(),
        dotCompletion());
}

function bracketCompletion() {
    return vscode.languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                if (!isComponentHtml(document)) {
                    return undefined;
                }

                const snippetCompletion = new vscode.CompletionItem('{{translate}}');
                snippetCompletion.insertText = new vscode.SnippetString(' \'${1}\' | translate ');
                snippetCompletion.documentation = new vscode.MarkdownString("Inserts translate snippet.");

                // a completion item that can be accepted by a commit character,
                // the `commitCharacters`-property is set which means that the completion will
                // be inserted and then the character will be typed.
                // const commitCharacterCompletion = new vscode.CompletionItem(' \'\' | translate ');
                // commitCharacterCompletion.commitCharacters = ['\''];
                // commitCharacterCompletion.documentation = new vscode.MarkdownString('Press `.` to get `console.`');

                // a completion item that retriggers IntelliSense when being accepted,
                // the `command`-property is set which the editor will execute after 
                // completion has been inserted. Also, the `insertText` is set so that 
                // a space is inserted after `new`
                // const commandCompletion = new vscode.CompletionItem('new');
                // commandCompletion.kind = vscode.CompletionItemKind.Keyword;
                // commandCompletion.insertText = 'new ';
                // commandCompletion.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };
                // return all completion items as array
                return [
                    snippetCompletion,
                ];
            }
        },
    );
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

                return [
                    new vscode.CompletionItem('log', vscode.CompletionItemKind.Method),
                    new vscode.CompletionItem('warn', vscode.CompletionItemKind.Method),
                    new vscode.CompletionItem('error', vscode.CompletionItemKind.Method),
                ];
            }
        },
        '.',
    );
}

function isComponentHtml(document: vscode.TextDocument) {
    return document.fileName.endsWith('.component.html');
}