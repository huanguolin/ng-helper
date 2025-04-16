import { ExtensionContext } from 'vscode';

import { activateExt } from './activate';
import { registerCodeLens } from './features/codeLens';
import { registerCommand } from './features/command';
import { registerCompletion } from './features/completion';
import { registerDefinition } from './features/definition';
import { registerHover } from './features/hover';
import { supportInlineHtml } from './features/inlineHtml';
import { registerLink } from './features/link';
import { registerSemantic } from './features/semantic';
import { registerStatusBar } from './features/statusBar';

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
    registerCommand(context, config);

    // status bar
    registerStatusBar(context);

    // completion
    registerCompletion(context, config.port);

    // hover
    registerHover(context, config.port);

    // definition
    registerDefinition(context, config.port);

    // semantic
    registerSemantic(context, config.port);

    // code lens
    registerCodeLens(context, config.port);

    // link
    registerLink(context, config.port);

    // inline html
    supportInlineHtml(context, config.port);
}

// This method is called when your extension is deactivated
export function deactivate() {}
