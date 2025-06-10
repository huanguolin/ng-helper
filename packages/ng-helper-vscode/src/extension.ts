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
import { StateControl } from './service/stateControl';
import { TsService } from './service/tsService/tsService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    const config = await activateExt();
    if (!config) {
        return;
    }

    // This line of code will only be executed once when your extension is activated
    console.log('======= "ng-helper" is now active ========');

    const pluginStartAt = Date.now();
    const stateControl = new StateControl(pluginStartAt);
    const tsService = new TsService(stateControl);
    const rpcApi = tsService.start(config.port);

    context.subscriptions.push(tsService);

    // TODO：
    // 1. config 在 client 要限定插件起效的文件范围
    // 2. status bar 显示配置的 project 状态

    // command
    registerCommand(context, config);

    // status bar
    registerStatusBar(context, stateControl);

    // completion
    registerCompletion(context, rpcApi);

    // hover
    registerHover(context, rpcApi);

    // definition
    registerDefinition(context, rpcApi);

    // semantic
    registerSemantic(context, rpcApi);

    // code lens
    registerCodeLens(context, rpcApi);

    // link
    registerLink(context, rpcApi);

    // inline html
    supportInlineHtml(context, rpcApi);
}

// This method is called when your extension is deactivated
export function deactivate() {}
