import type { NgContext } from '../../ngContext';
import type { StateControl } from '../../service/stateControl';

import { ngHelperStatusBar } from './ngHelperStatusBar';

export function registerStatusBar(ngContext: NgContext, stateControl: StateControl) {
    ngContext.vscodeContext.subscriptions.push(ngHelperStatusBar(stateControl));
}
