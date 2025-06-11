import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import getPort from 'get-port';
import * as vscode from 'vscode';

import type { NgHelperConfig } from '../activate';
import { pluginId, typeScriptExtensionId } from '../constants';
import { logger } from '../logger';
import { getWorkspacePath, normalizePath } from '../utils';

/**
 * see https://github.com/Microsoft/vscode/blob/main/extensions/typescript-language-features/src/api.ts
 */
declare class ApiV0 {
    configurePlugin(pluginId: string, configuration: unknown): void;
}

/**
 * see https://github.com/Microsoft/vscode/blob/main/extensions/typescript-language-features/src/api.ts
 */
interface Api {
    getAPI(version: 0): ApiV0 | undefined;
}

export async function configTsPluginConfiguration(
    defaultPort: number,
    config: NgHelperConfig,
): Promise<number | undefined> {
    const extension = vscode.extensions.getExtension<Api>(typeScriptExtensionId);
    if (!extension) {
        return;
    }

    await extension.activate();
    const extApi = extension.exports;
    if (!extApi?.getAPI) {
        return;
    }

    const api = extApi.getAPI(0);
    if (!api) {
        return;
    }

    const port = await getPort({ port: defaultPort });
    const configuration = buildTsPluginConfiguration(port, config);

    logger.logInfo('====> ts plugin config: ', configuration);

    api.configurePlugin(pluginId, configuration);

    return port;
}

function buildTsPluginConfiguration(port: number, config: NgHelperConfig): NgPluginConfiguration {
    const configuration: NgPluginConfiguration = {
        port,
        injectionCheckMode: config.injectionCheckMode,
    };

    if (config.projectMapping) {
        const workspacePath = getWorkspacePath()!.fsPath;
        const normalizeProjectPath = (p: string) => normalizePath(workspacePath + '/' + p);
        configuration.projectMappings = Array.from(Object.entries(config.projectMapping)).map(([tsName, ngNames]) => ({
            tsProjectPath: normalizeProjectPath(config.typescriptProjects![tsName]),
            ngProjectPaths: ngNames.map((ngName) => normalizeProjectPath(config.angularJsProjects![ngName])),
        }));
    }

    return configuration;
}
