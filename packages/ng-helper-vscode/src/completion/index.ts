import * as vscode from 'vscode';
import { dotCompletion } from './tsCompletion';
import { ngCompletion } from './ngCompletion';


export function registerComponentCompletions(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // dotCompletion(),
        ngCompletion());
}
