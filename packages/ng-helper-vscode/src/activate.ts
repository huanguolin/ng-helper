import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import { Uri, commands, workspace } from 'vscode';

import { EXT_CONF_PATH, EXT_IS_ACTIVATED, defaultPort } from './constants';
import { logger } from './logger';
import { configTsPluginConfiguration } from './service/configTsPlugin';
import { getWorkspacePath, isFileExistsOnWorkspace, normalizeFileExt } from './utils';

export async function activateExt(): Promise<NgHelperConfigWithPort | undefined> {
    const canActivated = await canActivate();
    if (!canActivated) {
        return;
    }

    const config = await readConfig();

    logger.logInfo('====> config: ', config);

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
    const jsonText = new TextDecoder().decode(uint8Array);

    let config = getDefaultConfig();
    const userConfig = JSON.parse(jsonText || '{}') as NgHelperConfig;
    config = Object.assign(config, userConfig);

    // TODO：校验 config，如果有问题提醒用户

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
        angularJsProjects: config.angularJsProjects,
        typescriptProjects: config.typescriptProjects,
        projectMapping: config.projectMapping,
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
    /**
     * AngularJS projects configuration with their paths (optional)
     * Key: project name, Value: project path
     */
    angularJsProjects?: Record<string, string>;
    /**
     * TypeScript projects configuration with their paths (optional)
     * Key: project name, Value: project path
     */
    typescriptProjects?: Record<string, string>;
    /**
     * Mapping between TypeScript and AngularJS projects (optional)
     * Key: TypeScript project name, Value: Array of AngularJS project names
     * If not provided, the extension will auto mapping.
     */
    projectMapping?: Record<string, string[]>;
}

export interface NgHelperConfigWithPort extends NgHelperConfig {
    port: number;
}
