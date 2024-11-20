import * as assert from 'assert';

import { suite, test } from 'mocha';
import * as vscode from 'vscode';

import { CREATE_COMPONENT_COMMAND } from '../testConstants';

suite('Command', () => {
    test("Should register 'Create Component' command", async () => {
        // 1. 获取所有已注册的命令
        const allCommands = await vscode.commands.getCommands();
        // 2. 验证我们的命令是否已注册
        assert.ok(allCommands.includes(CREATE_COMPONENT_COMMAND), 'command should be registered');
    });
});
