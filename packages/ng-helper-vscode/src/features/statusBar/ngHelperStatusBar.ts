import { StatusBarAlignment, ThemeColor, window, type TextEditor } from 'vscode';

import { logger } from '../../logger';
import type { NgContext } from '../../ngContext';
import type { BarStatus, StateControl } from '../../service/stateControl';
import { getNormalizedPathFromDocument } from '../utils';

const myLogger = logger.prefixWith('ngHelperStatusBar');

export function ngHelperStatusBar(ngContext: NgContext, stateControl: StateControl) {
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);

    let visible = false;
    let currentNgProjectName = '';
    let currentTsServerStatus: BarStatus = 'disconnect';
    let loadedTsProjectRootPaths: string[] = [];

    // 初始渲染
    renderWithActiveTextEditor(window.activeTextEditor);

    // 依据当前激活文件决定是否显示 status bar
    window.onDidChangeActiveTextEditor(renderWithActiveTextEditor);

    // 订阅 tsserver 状态，并更新 status bar
    stateControl.notifyStatusBar((tsServerStatus, tsProjectRoots) => {
        currentTsServerStatus = tsServerStatus;
        loadedTsProjectRootPaths = tsProjectRoots;
        renderBarItem();
    });

    return statusBarItem;

    function renderWithActiveTextEditor(editor: TextEditor | undefined) {
        if (!editor) {
            visible = false;
            currentNgProjectName = '';
        } else {
            visible = ngContext.isNgProjectDocument(editor.document);
            const filePath = getNormalizedPathFromDocument(editor.document);
            currentNgProjectName = ngContext.config.getNgProject(filePath)?.name || '';
        }

        myLogger.logInfo('currentNgProjectName:', currentNgProjectName);

        renderBarItem();
    }

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
        statusBarItem.text = '$(x) NgHelper';
        statusBarItem.tooltip = 'Lost connection to tsserver.';
        statusBarItem.color = new ThemeColor('statusBarItem.errorForeground');
        statusBarItem.backgroundColor = new ThemeColor('statusBarItem.errorBackground');
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
        const ngProjectNames = getLoadedProjectNames(loadedTsProjectRootPaths);

        const loadedProjectStr = `Loaded projects: ${ngProjectNames.map((n) => `"${n}"`).join(',')}`;

        if (!currentNgProjectName) {
            statusBarItem.text = '$(check) NgHelper';
            statusBarItem.tooltip = 'Ready.';
            statusBarItem.color = new ThemeColor('statusBarItem.foreground');
            statusBarItem.backgroundColor = new ThemeColor('statusBarItem.background');
        } else if (ngProjectNames.includes(currentNgProjectName)) {
            statusBarItem.text = '$(check) NgHelper';
            statusBarItem.tooltip = `Ready for "${currentNgProjectName}". ${loadedProjectStr}.`;
            statusBarItem.color = new ThemeColor('statusBarItem.foreground');
            statusBarItem.backgroundColor = new ThemeColor('statusBarItem.background');
        } else {
            statusBarItem.text = '$(alert) NgHelper';
            statusBarItem.tooltip = `Not ready for "${currentNgProjectName}". ${loadedProjectStr}.`;
            statusBarItem.color = new ThemeColor('statusBarItem.warningForeground');
            statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
        }
    }

    function getLoadedProjectNames(tsProjectRoots: string[]): string[] {
        if (ngContext.config.hasProjectConfig) {
            return tsProjectRoots
                .map((p) => ngContext.config.getNgProjectByTsProjectPath(p)?.name)
                .filter((x) => !!x) as string[];
        }
        return [];
    }
}
