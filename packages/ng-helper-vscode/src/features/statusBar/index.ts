import { ExtensionContext } from 'vscode';

import type { StateControl } from '../../service/stateControl';

import { ngHelperStatusBar } from './ngHelperStatusBar';

export function registerStatusBar(context: ExtensionContext, stateControl: StateControl) {
    context.subscriptions.push(ngHelperStatusBar(stateControl));
}
