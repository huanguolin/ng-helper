import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import { Uri, commands, workspace } from 'vscode';

import { EXT_CONF_PATH, EXT_IS_ACTIVATED, defaultPort } from './constants';
import { configTsPluginConfiguration } from './service/configTsPlugin';
import { getWorkspacePath, isFileExistsOnWorkspace, normalizeFileExt } from './utils';

export async function activateExt(): Promise<NgHelperConfigWithPort | undefined> {
    const canActivated = await canActivate();
    if (!canActivated) {
        return;
    }

    const config = await readConfig();

    const port = await configTsPluginConfiguration(defaultPort, config);
    if (!port) {
        return;
    }

    await commands.executeCommand('setContext', EXT_IS_ACTIVATED, true);

    return Object.assign(config, { port });
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
    return normalizeConfig(config);
}

function getDefaultConfig(): NgHelperConfig {
    return {
        componentStyleFileExt: 'css',
        componentScriptFileExt: 'js',
        injectionCheckMode: 'count_match',
    };
}

function normalizeConfig(config: NgHelperConfig): NgHelperConfig {
    return {
        componentStyleFileExt: normalizeFileExt(config.componentStyleFileExt),
        componentScriptFileExt: normalizeFileExt(config.componentScriptFileExt),
        injectionCheckMode: config.injectionCheckMode,
    };
}

function getConfigUri(): Uri | undefined {
    const rootWorkspaceUri = getWorkspacePath();
    if (!rootWorkspaceUri) {
        return;
    }
    return Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
}

export interface NgHelperConfig {
    /**
     * like 'less', 'scss', 'css' etc, default is 'css';
     */
    componentStyleFileExt: string;
    /**
     * 'js' or 'ts', default is 'js';
     */
    componentScriptFileExt: string;
    injectionCheckMode: InjectionCheckMode;
}

export interface NgHelperConfigWithPort extends NgHelperConfig {
    port: number;
}
