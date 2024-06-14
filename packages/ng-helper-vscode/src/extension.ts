// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { createComponentCommand } from './createComponent';
import { registerComponentCompletions } from './completion';
import { ExtensionContext, Uri, commands, workspace } from 'vscode';

const EXT_CONF_PATH = '.vscode/ng-helper.json';
const EXT_IS_ACTIVATED = 'ng-helper.activated';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
	const canActivated = await canActivate(context);
	if (!canActivated) {
		return;
	}

	commands.executeCommand('setContext', EXT_IS_ACTIVATED, true);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('======= "ng-helper" is now active ========');

	// command
	context.subscriptions.push(createComponentCommand());

	// completion
	registerComponentCompletions(context);
}

// This method is called when your extension is deactivated
export function deactivate() {
}

async function canActivate(context: ExtensionContext): Promise<boolean> {
	const workspaceFolders = workspace.workspaceFolders;
	if (!workspaceFolders) {
		return false;
	}

	const rootWorkspaceUri = workspaceFolders[0].uri;
	const confUri = Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
	try {
		// 文件不存在会 throw error
		await workspace.fs.stat(confUri);
		return true;
	} catch {
		return false;
	}
}
