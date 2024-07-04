import { ExtensionContext } from 'vscode';

import { ngCompletion } from './ngCompletion';
import { typeCompletion } from './typeCompletion';

export function registerComponentCompletions(context: ExtensionContext, port: number) {
    context.subscriptions.push(typeCompletion(port), ngCompletion(port));
}
