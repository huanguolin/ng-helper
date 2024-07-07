import { Uri, commands, workspace } from 'vscode';

import { EXT_CONF_PATH, EXT_IS_ACTIVATED, defaultPort } from './constants';
import { configTsPluginConfiguration } from './service/config';
import { isFileExistsOnWorkspace } from './utils';

export async function activateExt(): Promise<number | undefined> {
    const canActivated = await canActivate();
    if (!canActivated) {
        return;
    }

    const port = await configTsPluginConfiguration(defaultPort);
    if (!port) {
        return;
    }

    await commands.executeCommand('setContext', EXT_IS_ACTIVATED, true);

    return port;
}

async function canActivate(): Promise<boolean> {
    const confUri = getConfigUri();
    if (!confUri) {
        return false;
    }
    return await isFileExistsOnWorkspace(confUri);
}

export async function readConfig(): Promise<NgHelperConfig> {
    const uri = getConfigUri()!;
    const uint8Array = await workspace.fs.readFile(uri);
    // uint8Array to string
    const jsonText = new TextDecoder().decode(uint8Array);

    let config = getDefaultConfig();
    try {
        const userConfig = JSON.parse(jsonText || '{}') as NgHelperConfig;
        config = Object.assign(config, userConfig);
    } catch (error) {
        console.error('ng-helper.json is not a valid JSON file: ', jsonText);
    }
    return config;
}

function getDefaultConfig(): NgHelperConfig {
    return {
        componentCssFileExt: 'css',
    };
}

function getConfigUri(): Uri | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    const rootWorkspaceUri = workspaceFolders[0].uri;
    return Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
}

export interface NgHelperConfig {
    /**
     * like 'less', 'scss', 'css' etc. default is 'css';
     */
    componentCssFileExt: string;
}
