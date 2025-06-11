import type { NgContext } from '../../ngContext';

import { searchUseOfComponentOrDirective } from './useOfComponentOrDirective';

export function registerCodeLens(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(searchUseOfComponentOrDirective(ngContext.rpcApi));
}
