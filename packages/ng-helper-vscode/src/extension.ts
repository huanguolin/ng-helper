import { createComponentCommand } from './command/createComponent';
import { registerComponentCompletions } from './completion';
import { ExtensionContext } from 'vscode';
import { activateExt } from './activate';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
	const port = await activateExt();
    if (!port) {
        return;
    }

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('======= "ng-helper" is now active ========');

	// command
	context.subscriptions.push(createComponentCommand());

	// completion
	registerComponentCompletions(context, port);
}

// This method is called when your extension is deactivated
export function deactivate() { }



