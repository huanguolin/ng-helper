import { NgPluginConfiguration, type InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import type { NgHelperUserConfig } from '@ng-helper/shared/lib/userConfig';
import getPort from 'get-port';
import * as vscode from 'vscode';

import { pluginId, typeScriptExtensionId } from '../constants';
import { logger } from '../logger';

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
    config: NgHelperUserConfig,
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

function buildTsPluginConfiguration(port: number, config: NgHelperUserConfig): NgPluginConfiguration {
    const configuration: NgPluginConfiguration = {
        port,
        injectionCheckMode: config.injectionCheckMode as InjectionCheckMode,
    };

    if (config.ngProjects) {
        const mappingList: NgPluginConfiguration['projectMappings'] = [];
        for (const p of config.ngProjects) {
            mappingList.push({
                ngProjectName: p.name,
                ngProjectPath: p.path,
                tsProjectPath: p.dependOnTsProjectPath!,
            });
        }

        configuration.projectMappings = mappingList;
    }

    return configuration;
}
