import * as vscode from 'vscode';

export function createCommand(commandName: string, callback: (...args: any[]) => any, thisArg?: any) {
    return vscode.commands.registerCommand(`ng-helper.${commandName}`, async (...args: any[]) => {
        console.log(`Execute command ${commandName} with args: `, args);
        try {
            return await callback(...args);
        } catch (error) {
            vscode.window.showErrorMessage(`Execute command ${commandName} error: ${JSON.stringify(error)}`);
        }
    }, thisArg);
}