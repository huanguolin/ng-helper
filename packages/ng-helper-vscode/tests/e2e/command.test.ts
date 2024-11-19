/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as assert from 'assert';

import { suite, test, suiteSetup } from 'mocha';
import * as vscode from 'vscode';

import { COMMAND_ID } from '../testConstants';
import { confirmExtensionActive } from '../testUtils';

suite('Command Test Suite', () => {
    suiteSetup(confirmExtensionActive);

    test("Should register 'Create Component' command", async () => {
        // 1. 获取所有已注册的命令
        const allCommands = await vscode.commands.getCommands();
        // 2. 验证我们的命令是否已注册
        assert.ok(allCommands.includes(COMMAND_ID), 'command should be registered');
    });
});
