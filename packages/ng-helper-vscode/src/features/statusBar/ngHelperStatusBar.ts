import { StatusBarAlignment, window } from 'vscode';

import type { StateControl } from '../../service/stateControl';

export function ngHelperStatusBar(stateControl: StateControl) {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);

    disconnected();
    statusBarItem.show();

    stateControl.notifyStatusBar((status, _projectStateMap) => {
        switch (status) {
            case 'disconnect':
                disconnected();
                break;
            case 'loading':
                loading();
                break;
            case 'connected':
                ready();
                break;
            default:
                break;
        }
        // TODO: update tooltip
    });

    return statusBarItem;

    function disconnected() {
        statusBarItem.text = '$(plug) Disconnect';
        statusBarItem.tooltip = '[ng-helper] Lost connection to tsserver.';
        statusBarItem.color = '#F00';
    }

    function ready() {
        statusBarItem.text = '$(check) Ready';
        statusBarItem.tooltip = '[ng-helper] Ready.';
        statusBarItem.color = '#FFF';
    }

    function loading() {
        statusBarItem.text = '$(sync~spin) Loading';
        statusBarItem.tooltip = '[ng-helper] Loading ...';
        statusBarItem.color = '#FFF';
    }
}
