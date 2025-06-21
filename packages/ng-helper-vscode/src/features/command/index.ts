import type { NgContext } from '../../ngContext';

import { createComponentCommand } from './createComponent';
import { exportComponentAndDirectiveExprAttrCommand } from './exportComponentAndDirectiveExprAttr';
import { openConfigFile } from './openConfigFile';
import { showStatusBarMenu } from './showStatusBarMenu';

export function registerCommand(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        createComponentCommand(ngContext),
        openConfigFile(ngContext),
        exportComponentAndDirectiveExprAttrCommand(ngContext),
        showStatusBarMenu(ngContext),
    );
}
