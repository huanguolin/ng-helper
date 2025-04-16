import { StatusBarAlignment, window } from 'vscode';

export function ngHelperStatusBar() {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
    lostConnection();
    statusBarItem.show();

    // TODO: 依据实际状态来设置状态栏
    setTimeout(connecting, 3000);

    setTimeout(ready, 6000);

    return statusBarItem;

    function lostConnection() {
        statusBarItem.text = '$(plug) Disconnect';
        statusBarItem.tooltip = '[ng-helper] Lost connection to tsserver.';
        statusBarItem.color = '#F00';
    }

    function ready() {
        statusBarItem.text = '$(check) Ready';
        statusBarItem.tooltip = '[ng-helper] Ready.';
        statusBarItem.color = '#FFF';
    }

    function connecting() {
        statusBarItem.text = '$(sync~spin) Connecting';
        statusBarItem.tooltip = '[ng-helper] Connecting to tsserver...';
        statusBarItem.color = '#FFF';
    }
}
