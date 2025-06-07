import { commands, window } from 'vscode';

import { logger } from '../../logger';

const myLogger = logger.prefixWith('Command');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCommand(commandName: string, callback: (...args: any[]) => any, thisArg?: any) {
    return commands.registerCommand(
        `ng-helper.${commandName}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (...args: any[]) => {
            myLogger.logInfo(`Execute command ${commandName} with args: `, args);
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument
                return await callback(...args);
            } catch (error) {
                await window.showErrorMessage(`Execute command ${commandName} error: ${JSON.stringify(error)}`);
            }
        },
        thisArg,
    );
}
