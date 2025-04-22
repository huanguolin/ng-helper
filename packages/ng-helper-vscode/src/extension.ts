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
import { RpcServer } from './service/rpcServer';
import { TsService } from './service/tsService';

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

    const rpcServer = new RpcServer(config.port);
    const tsService = new TsService(rpcServer);

    context.subscriptions.push(rpcServer);

    // command
    registerCommand(context, config);

    // status bar
    registerStatusBar(context, rpcServer);

    // completion
    registerCompletion(context, tsService);

    // hover
    registerHover(context, tsService);

    // definition
    registerDefinition(context, tsService);

    // semantic
    registerSemantic(context, tsService);

    // code lens
    registerCodeLens(context, tsService);

    // link
    registerLink(context, tsService);

    // inline html
    supportInlineHtml(context, tsService);
}

// This method is called when your extension is deactivated
export function deactivate() {}
