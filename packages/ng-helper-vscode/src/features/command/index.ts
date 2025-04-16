import { ExtensionContext } from 'vscode';

import type { NgHelperConfigWithPort } from '../../activate';

import { createComponentCommand } from './createComponent';

export function registerCommand(context: ExtensionContext, config: NgHelperConfigWithPort) {
    context.subscriptions.push(createComponentCommand(config.componentStyleFileExt, config.componentScriptFileExt));
}
