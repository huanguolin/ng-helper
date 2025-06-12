import type { NgContext } from '../../ngContext';

import { createComponentCommand } from './createComponent';

export function registerCommand(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        createComponentCommand(
            ngContext.config.userConfig.componentStyleFileExt,
            ngContext.config.userConfig.componentScriptFileExt,
        ),
    );
}
