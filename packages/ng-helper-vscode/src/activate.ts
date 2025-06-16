import { commands, RelativePattern, window, workspace, type ExtensionContext } from 'vscode';

import { NgHelperConfig, readUserConfig, getUserConfigFileUri } from './config';
import { EXT_CONF_PATH, EXT_IS_ACTIVATED, defaultPort } from './constants';
import { logger } from './logger';
import { configTsPluginConfiguration } from './service/configTsPlugin';
import { getWorkspacePath, isFileExistsOnWorkspace } from './utils';

export async function activateExt(vscodeContext: ExtensionContext): Promise<NgHelperConfig | undefined> {
    /**
     * 监听用户配置文件的变化。
     * 如果变化了，需要重新初始化插件才能生效。
     * 里面简单弹出一个对话框，让用户 reloadWindow。
     */
    watchUserConfig(vscodeContext);

    const canActivated = await canActivate();
    if (!canActivated) {
        return;
    }

    const userConfig = await readUserConfig();

    logger.logInfo('====> ng-helper user config: ', userConfig);

    const port = await configTsPluginConfiguration(defaultPort, userConfig);
    if (!port) {
        return;
    }

    await commands.executeCommand('setContext', EXT_IS_ACTIVATED, true);

    return new NgHelperConfig(userConfig, port);
}

async function canActivate(): Promise<boolean> {
    const confUri = getUserConfigFileUri();
    if (!confUri) {
        return false;
    }
    return await isFileExistsOnWorkspace(confUri);
}

function watchUserConfig(vscodeContext: ExtensionContext) {
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(getWorkspacePath()!, EXT_CONF_PATH));

    vscodeContext.subscriptions.push(watcher);

    watcher.onDidCreate(() => handleFileChange('create'));
    watcher.onDidDelete(() => handleFileChange('delete'));
    watcher.onDidChange(() => handleFileChange('change'));

    async function handleFileChange(type: 'delete' | 'create' | 'change') {
        const message = {
            delete: 'The ng-helper configuration file has been deleted. Please reload the window to disable the plugin.',
            create: 'The ng-helper configuration file has been created. Please reload the window to enable the plugin.',
            change: 'The ng-helper configuration file has been changed. Please reload the window to apply the changes.',
        }[type];
        const selection = await window.showInformationMessage(message, 'OK', 'Cancel');
        if (selection === 'OK') {
            await commands.executeCommand('workbench.action.reloadWindow');
        }
    }
}
