import { ExtensionContext } from 'vscode';

import { activateExt } from './activate';
import { createComponentCommand } from './features/command/createComponent';
import { registerCompletion } from './features/completion';
import { registerDefinition } from './features/definition';
import { registerGotoHtml } from './features/gotoHtml';
import { registerHover } from './features/hover';
import { supportInlineHtml } from './features/inlineHtml';
import { registerSemantic } from './features/semantic';

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
    registerCompletion(context, config.port);

    // hover
    registerHover(context, config.port);

    // definition
    registerDefinition(context, config.port);

    // semantic
    registerSemantic(context, config.port);

    // goto html
    registerGotoHtml(context);

    // inline html
    supportInlineHtml(context, config.port);
}

// This method is called when your extension is deactivated
export function deactivate() {}
