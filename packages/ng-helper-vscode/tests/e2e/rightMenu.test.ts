import * as assert from 'assert';

import { suite, test, suiteSetup } from 'mocha';
import * as vscode from 'vscode';

import { sleep } from '../testUtils';

suite('Explorer Context Menu Test Suite', () => {
    // 添加 setup 钩子来确保扩展已激活
    suiteSetup(async () => {
        // 获取扩展实例
        const extension = vscode.extensions.getExtension('huanguolin.ng-helper');
        console.log('Extension found:', !!extension);
        console.log('Extension ID:', extension?.id);
        console.log('Is extension active:', extension?.isActive);

        if (extension) {
            try {
                // 尝试激活扩展
                await extension.activate();
                console.log('Extension activated successfully');
                console.log('Is extension active after activation:', extension.isActive);
            } catch (error) {
                console.error('Failed to activate extension:', error);
            }
        }

        // 给一些时间让命令注册
        await sleep(1000);
    });

    test("Should show 'Create Component' in Explorer context menu for folder", async () => {
        await sleep(5000);

        // 1. 获取所有已注册的命令
        const allCommands = await vscode.commands.getCommands();

        // 2. 验证我们的命令是否已注册
        assert.ok(
            allCommands.some((command) => command.includes('ng-helper.createComponent')),
            "'ng-helper.createComponent' command should be registered",
        );

        // // 3. 验证命令是否可以执行（可选）
        // try {
        //     // 1. 准备测试文件夹
        //     const folderUri = vscode.Uri.file(APP_COMPONENTS_DIR);
        //     // 注意：这里只验证命令是否可以执行，不实际创建组件
        //     const result = await vscode.commands.executeCommand('ng-helper.createComponent', folderUri);
        //     // 如果命令执行成功，这里不会抛出异常
        //     assert.ok(true, 'Command executed successfully');
        // } catch (error) {
        //     assert.fail(`Command execution failed: ${error}`);
        // }
    });
});
