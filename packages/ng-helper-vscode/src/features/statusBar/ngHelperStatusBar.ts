import { StatusBarAlignment, ThemeColor, window } from 'vscode';

import type { NgContext } from '../../ngContext';
import type { BarStatus, StateControl } from '../../service/stateControl';

export function ngHelperStatusBar(ngContext: NgContext, stateControl: StateControl) {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
    statusBarItem.command = 'ng-helper.showStatusBarMenu';

    let currentNgProjectName = ngContext.activatedProjectName;
    let visible = !!currentNgProjectName;
    let currentTsServerStatus: BarStatus = 'disconnect';

    // 初始渲染
    renderBarItem();

    // 依据当前激活项目决定是否显示 status bar
    ngContext.onActivatedProjectNameChanged((name) => {
        currentNgProjectName = name ?? '';
        visible = !!name;
        renderBarItem();
    });

    // 订阅 tsserver 状态，并更新 status bar
    stateControl.notifyStatusBar((tsServerStatus) => {
        currentTsServerStatus = tsServerStatus;
        renderBarItem();
    });

    return statusBarItem;

    function renderBarItem() {
        if (!visible) {
            statusBarItem.hide();
            return;
        }

        switch (currentTsServerStatus) {
            case 'disconnect':
                setDisconnected();
                break;
            case 'loading':
                setLoading();
                break;
            case 'connected':
                setStatusByCurrentNgProject();
                break;
            default:
                break;
        }
        statusBarItem.show();
    }

    function setDisconnected() {
        statusBarItem.text = '$(debug-disconnect) NgHelper';
        statusBarItem.tooltip = 'Lost connection to tsserver.';
        // 这里显示 error 颜色的话，有点太刺眼了，warning 好一点
        statusBarItem.color = new ThemeColor('statusBarItem.warningForeground');
        statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
    }

    function setLoading() {
        statusBarItem.text = '$(sync~spin) NgHelper';
        if (currentNgProjectName) {
            statusBarItem.tooltip = `Load the TypeScript project for AngularJS project "${currentNgProjectName}".`;
        } else {
            statusBarItem.tooltip = 'Load TypeScript project.';
        }
        statusBarItem.color = new ThemeColor('statusBarItem.foreground');
        statusBarItem.backgroundColor = new ThemeColor('statusBarItem.background');
    }

    function setStatusByCurrentNgProject() {
        const ngProjectNames = ngContext.getLoadedProjectNames();

        const loadedProjectStr = ngProjectNames.map((n) => `"${n}"`).join(',');

        if (!currentNgProjectName) {
            statusBarItem.text = '$(check) NgHelper';
            statusBarItem.tooltip = `Ready. Loaded js/ts projects: ${loadedProjectStr}.`;
            statusBarItem.color = new ThemeColor('statusBarItem.foreground');
            statusBarItem.backgroundColor = new ThemeColor('statusBarItem.background');
        } else if (ngProjectNames.includes(currentNgProjectName)) {
            statusBarItem.text = '$(check) NgHelper';
            statusBarItem.tooltip = `Ready for "${currentNgProjectName}". Loaded projects: ${loadedProjectStr}.`;
            statusBarItem.color = new ThemeColor('statusBarItem.foreground');
            statusBarItem.backgroundColor = new ThemeColor('statusBarItem.background');
        } else {
            statusBarItem.text = '$(alert) NgHelper';
            statusBarItem.tooltip = `Not ready for "${currentNgProjectName}". Loaded projects: ${loadedProjectStr}.`;
            statusBarItem.color = new ThemeColor('statusBarItem.warningForeground');
            statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
        }
    }
}
