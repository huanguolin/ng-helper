import { ExtensionContext } from 'vscode';

import { componentAttr } from './componentAttr';
import { componentName } from './componentName';
import { ctrl } from './ctrl';
import { ngDirective } from './ngDirective';
import { type } from './type';

export function registerComponentCompletions(context: ExtensionContext, port: number) {
    context.subscriptions.push(type(port), ctrl(port), ngDirective(port), componentName(port), componentAttr(port));
}
