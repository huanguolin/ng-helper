import { commands, window } from "vscode";

export function createCommand(commandName: string, callback: (...args: any[]) => any, thisArg?: any) {
    return commands.registerCommand(`ng-helper.${commandName}`, async (...args: any[]) => {
        console.log(`Execute command ${commandName} with args: `, args);
        try {
            return await callback(...args);
        } catch (error) {
            window.showErrorMessage(`Execute command ${commandName} error: ${JSON.stringify(error)}`);
        }
    }, thisArg);
}