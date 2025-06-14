import { StatusBarAlignment, ThemeColor, window } from 'vscode';

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
        statusBarItem.text = '$(alert) NgHelper';
        statusBarItem.tooltip = 'Lost connection to tsserver.';
        statusBarItem.color = new ThemeColor('statusBarItem.warningForeground');
        statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
    }

    function ready(projectRoots: string[]) {
        const projectNames = getProjectNames(projectRoots).join(', ');
        statusBarItem.text = '$(check) NgHelper';
        statusBarItem.tooltip = `Ready. (Projects: ${projectNames})`;
        statusBarItem.color = new ThemeColor('statusBar.foreground');
        statusBarItem.backgroundColor = new ThemeColor('statusBar.background');
    }

    function loading() {
        statusBarItem.text = '$(sync~spin) NgHelper';
        statusBarItem.tooltip = 'Loading ...';
        statusBarItem.color = new ThemeColor('statusBar.foreground');
        statusBarItem.backgroundColor = new ThemeColor('statusBar.background');
    }
}

function getProjectNames(projectRoots: string[]): string[] {
    return projectRoots.map((p) => getLastFolderName(p));
}
