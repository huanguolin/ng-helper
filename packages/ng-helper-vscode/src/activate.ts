import { createHash } from 'crypto';

import { commands, RelativePattern, window, workspace, type ExtensionContext, type Uri } from 'vscode';

import { NgHelperConfig, readUserConfig, getUserConfigFileUri } from './config';
import { EXT_CONF_PATH, EXT_IS_ACTIVATED, defaultPort } from './constants';
import { logger } from './logger';
import { configTsPluginConfiguration } from './service/configTsPlugin';
import { getWorkspacePath, isFileExistsOnWorkspace } from './utils';

// 存储文件内容的哈希值
let fileContentHash: string = '';

export async function activateExt(vscodeContext: ExtensionContext): Promise<NgHelperConfig | undefined> {
    /**
     * 监听用户配置文件的变化。
     * 如果变化了，需要重新初始化插件才能生效。
     * 里面简单弹出一个对话框，让用户 reloadWindow。
     */
    setTimeout(() => {
        void watchUserConfig(vscodeContext);
    }, 1000); // 延时是避免启动太耗时

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

async function watchUserConfig(vscodeContext: ExtensionContext) {
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(getWorkspacePath()!, EXT_CONF_PATH));

    vscodeContext.subscriptions.push(watcher);

    const confUri = getUserConfigFileUri();
    if (confUri) {
        fileContentHash = await getFileContentHash(confUri);
    }

    watcher.onDidCreate((e) => handleFileChange('create', e));
    watcher.onDidDelete((e) => handleFileChange('delete', e));
    watcher.onDidChange((e) => handleFileChange('change', e));

    async function handleFileChange(type: 'delete' | 'create' | 'change', e: Uri) {
        // 对于 change 事件，检查文件内容是否真正发生了变化
        if (type === 'change' && !(await checkFileContentChanged(e))) {
            return;
        }

        const message = {
            delete: 'The ng-helper configuration file has been deleted. Please reload the window to disable the plugin.',
            create: 'The ng-helper configuration file has been created. Please reload the window to enable the plugin.',
            change: 'The ng-helper configuration file has been changed. Please reload the window to apply the changes.',
        }[type];
        const selection = await window.showInformationMessage(message, 'OK', 'Cancel');
        if (selection === 'OK') {
            await commands.executeCommand('ng-helper.showStatusBarMenu', 'reloadWindow');
        }
    }
}

async function getFileContentHash(fileUri: Uri): Promise<string> {
    try {
        const fileContent = await workspace.fs.readFile(fileUri);
        const contentString = new TextDecoder().decode(fileContent);
        return createHash('md5').update(contentString).digest('hex');
    } catch {
        return '';
    }
}

/**
 * 检查文件内容是否真正发生了变化
 * @param fileUri 文件URI
 * @returns 如果文件内容发生了变化返回true，否则返回false
 */
async function checkFileContentChanged(fileUri: Uri): Promise<boolean> {
    // 计算当前内容的哈希值
    const currentHash = await getFileContentHash(fileUri);
    // 获取之前存储的哈希值
    const previousHash = fileContentHash;
    // 更新哈希值
    fileContentHash = currentHash;

    return previousHash !== currentHash;
}
