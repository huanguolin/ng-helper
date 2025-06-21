import { commands, window } from 'vscode';

import type { NgContext } from '../../ngContext';

import { createCommand } from './utils';

export function showStatusBarMenu(_ngContext: NgContext) {
    return createCommand('showStatusBarMenu', async (commandKeyword?: string) => {
        await configStatusBarMenu(commandKeyword);
    });
}

const menuItems = [
    {
        label: '$(debug-restart) Reload Window',
        description: 'Reload VS Code Window',
        command: 'workbench.action.reloadWindow',
    },
    {
        label: '$(go-to-file) NgHelper: Open Config File',
        description: 'Open the NgHelper Config File',
        command: 'ng-helper.openConfigFile',
    },
    {
        label: '$(arrow-down) NgHelper: Export Expression Attributes',
        description: 'Export All Component and Directive Expression Attributes',
        command: 'ng-helper.exportComponentAndDirectiveExprAttr',
    },
];
async function configStatusBarMenu(commandKeyword?: string) {
    const menu = !commandKeyword ? menuItems : menuItems.filter((x) => x.command.includes(commandKeyword));
    const picked = await window.showQuickPick(menu, {
        placeHolder: 'Choose an action to run',
    });

    if (picked && picked.command) {
        await commands.executeCommand(picked.command);
    }
}
