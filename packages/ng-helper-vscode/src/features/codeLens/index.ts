import { ExtensionContext } from 'vscode';

import { searchUseOfComponentOrDirective } from './useOfComponentOrDirective';

export function registerCodeLens(context: ExtensionContext, port: number) {
    context.subscriptions.push(searchUseOfComponentOrDirective(port));
}
