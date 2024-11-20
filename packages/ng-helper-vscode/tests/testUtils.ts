import * as vscode from 'vscode';

import { MY_EXTENSION_ID } from './testConstants';

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function confirmExtensionActive() {
    const extension = vscode.extensions.getExtension(MY_EXTENSION_ID);
    if (!extension) {
        console.log('====> Extension found!!!');
        return;
    }

    console.log('Extension ID:', extension.id);

    if (extension && !extension.isActive) {
        // 如果扩展未激活，等待其激活
        await extension.activate();
        // 给更多时间让 VS Code 和扩展完全初始化
        await sleep(2_000);
    }

    console.log('Is extension active:', extension.isActive);
}
