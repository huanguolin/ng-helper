import { ExtensionContext } from 'vscode';

import { componentAttr } from './componentAttr';
import { componentName } from './componentName';
import { ctrl } from './ctrl';
import { customDirective } from './customDirective';
import { ngDirective } from './ngDirective';
import { type } from './type';

export function registerCompletion(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        type(port),
        ctrl(port),
        ngDirective(port),
        ...customDirective(port),
        componentName(port),
        componentAttr(port),
    );
}
