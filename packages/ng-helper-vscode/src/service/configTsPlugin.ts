import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import getPort from 'get-port';
import * as vscode from 'vscode';

import type { NgHelperConfig } from '../activate';
import { pluginId, typeScriptExtensionId } from '../constants';

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

    const port = await getPort({
        port: defaultPort,
    });
    const configuration: NgPluginConfiguration = {
        port,
        injectionCheckMode: config.injectionCheckMode,
    };
    api.configurePlugin(pluginId, configuration);

    return port;
}
