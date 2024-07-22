import { ExtensionContext } from 'vscode';

import { activateExt } from './activate';
import { createComponentCommand } from './features/command/createComponent';
import { registerComponentCompletions } from './features/completion';
import { registerComponentHover } from './features/hover';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    const config = await activateExt();
    if (!config) {
        return;
    }

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('======= "ng-helper" is now active ========');

    // command
    context.subscriptions.push(createComponentCommand(config.componentCssFileExt));

    // completion
    registerComponentCompletions(context, config.port);

    // hover
    registerComponentHover(context, config.port);
}

// This method is called when your extension is deactivated
export function deactivate() {}
