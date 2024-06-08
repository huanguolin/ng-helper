import * as vscode from 'vscode';

export function registerComponentCompletions(context: vscode.ExtensionContext) {
    context.subscriptions.push(dotCompletion());
}

function dotCompletion() {
    return vscode.languages.registerCompletionItemProvider(
		'html',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
				const isComponentHtml = document.fileName.endsWith('.component.html');
                if (!isComponentHtml) {
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