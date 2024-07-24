import { ExtensionContext } from 'vscode';

import { componentCtrl } from './componentCtrl';
import { componentName } from './componentName';
import { componentType } from './componentType';
import { ngDirective } from './ngDirective';

export function registerComponentCompletions(context: ExtensionContext, port: number) {
    context.subscriptions.push(componentType(port), componentCtrl(port), ngDirective(port), componentName(port));
}
