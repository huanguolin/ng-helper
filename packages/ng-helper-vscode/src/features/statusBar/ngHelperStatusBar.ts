import { StatusBarAlignment, window } from 'vscode';

import type { StateControl } from '../../service/stateControl';
import { getLastFolderName } from '../../utils';

export function ngHelperStatusBar(stateControl: StateControl) {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);

    disconnected();
    statusBarItem.show();

    stateControl.notifyStatusBar((status, projectRoots) => {
        switch (status) {
            case 'disconnect':
                disconnected();
                break;
            case 'loading':
                loading();
                break;
            case 'connected':
                ready(projectRoots);
                break;
            default:
                break;
        }
    });

    return statusBarItem;

    function disconnected() {
        statusBarItem.text = '$(plug) Disconnect';
        statusBarItem.tooltip = '[ng-helper] Lost connection to tsserver.';
        statusBarItem.color = '#F00';
    }

    function ready(projectRoots: string[]) {
        const projectNames = getProjectNames(projectRoots).join(', ');
        statusBarItem.text = '$(check) Ready';
        statusBarItem.tooltip = `[ng-helper] Ready. (Projects: ${projectNames})`;
        statusBarItem.color = '#FFF';
    }

    function loading() {
        statusBarItem.text = '$(sync~spin) Loading';
        statusBarItem.tooltip = '[ng-helper] Loading ...';
        statusBarItem.color = '#FFF';
    }
}

function getProjectNames(projectRoots: string[]): string[] {
    return projectRoots.map((p) => getLastFolderName(p));
}
