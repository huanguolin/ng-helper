import { dotCompletion } from './tsCompletion';
import { ngCompletion } from './ngCompletion';
import { ExtensionContext } from 'vscode';


export function registerComponentCompletions(context: ExtensionContext) {
    context.subscriptions.push(
        // dotCompletion(),
        ngCompletion());
}
