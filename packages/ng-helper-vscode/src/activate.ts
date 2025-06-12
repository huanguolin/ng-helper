import { commands } from 'vscode';

import { NgHelperConfig, readNgHelperUserConfig, getNgHelperUserConfigUri } from './config';
import { EXT_IS_ACTIVATED, defaultPort } from './constants';
import { logger } from './logger';
import { configTsPluginConfiguration } from './service/configTsPlugin';
import { isFileExistsOnWorkspace } from './utils';

export async function activateExt(): Promise<NgHelperConfig | undefined> {
    const canActivated = await canActivate();
    if (!canActivated) {
        return;
    }

    const userConfig = await readNgHelperUserConfig();

    logger.logInfo('====> ng-helper user config: ', userConfig);

    const port = await configTsPluginConfiguration(defaultPort, userConfig);
    if (!port) {
        return;
    }

    await commands.executeCommand('setContext', EXT_IS_ACTIVATED, true);

    return new NgHelperConfig(userConfig, port);
}

async function canActivate(): Promise<boolean> {
    const confUri = getNgHelperUserConfigUri();
    if (!confUri) {
        return false;
    }
    return await isFileExistsOnWorkspace(confUri);
}
