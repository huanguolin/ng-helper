import { ExtensionContext } from 'vscode';

import { componentAttr } from './componentAttr';
import { componentCtrl } from './componentCtrl';
import { componentName } from './componentName';
import { ngDirective } from './ngDirective';
import { type } from './type';

export function registerComponentCompletions(context: ExtensionContext, port: number) {
    context.subscriptions.push(type(port), componentCtrl(port), ngDirective(port), componentName(port), componentAttr(port));
}
