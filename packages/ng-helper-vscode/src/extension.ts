import { ExtensionContext } from 'vscode';

import { activateExt } from './activate';
import { registerCodeLens } from './features/codeLens';
import { registerCommand } from './features/command';
import { registerCompletion } from './features/completion';
import { registerDefinition } from './features/definition';
import { registerDiagnostic } from './features/diagnostic';
import { registerHover } from './features/hover';
import { supportInlineHtml } from './features/inlineHtml';
import { registerLink } from './features/link';
import { registerSemantic } from './features/semantic';
import { registerSignatureHelp } from './features/signatureHelp';
import { registerStatusBar } from './features/statusBar';
import { NgContext } from './ngContext';
import { StateControl } from './service/stateControl';
import { TsService } from './service/tsService/tsService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(vscodeContext: ExtensionContext) {
    const config = await activateExt(vscodeContext);
    if (!config) {
        return;
    }

    // This line of code will only be executed once when your extension is activated
    console.log('======= "ng-helper" is now active ========');

    const pluginStartAt = Date.now();
    const stateControl = new StateControl(pluginStartAt, config);
    const tsService = new TsService(stateControl);
    const rpcApi = tsService.start(config.port);
    const ngContext = new NgContext(vscodeContext, config, rpcApi);

    vscodeContext.subscriptions.push(tsService);

    // command
    registerCommand(ngContext);

    // status bar
    registerStatusBar(ngContext, stateControl);

    // completion
    registerCompletion(ngContext);

    // signature help
    registerSignatureHelp(ngContext);

    // hover
    registerHover(ngContext);

    // definition
    registerDefinition(ngContext);

    // semantic
    registerSemantic(ngContext);

    // diagnostic
    registerDiagnostic(ngContext);

    // code lens
    registerCodeLens(ngContext);

    // link
    registerLink(ngContext);

    // inline html
    supportInlineHtml(ngContext);
}

// This method is called when your extension is deactivated
export function deactivate() {}
