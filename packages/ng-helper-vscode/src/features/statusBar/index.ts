import { ExtensionContext } from 'vscode';

import { ngHelperStatusBar } from './ngHelperStatusBar';

export function registerStatusBar(context: ExtensionContext) {
    context.subscriptions.push(ngHelperStatusBar());
}
