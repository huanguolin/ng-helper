import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as vscode from 'vscode';

import { CREATE_COMPONENT_COMMAND } from '../testConstants';
import { activate } from '../testUtils';

describe('Command', () => {
    before(async () => {
        await activate();
    });

    it('Should register "Create Component" command', async () => {
        // 1. 获取所有已注册的命令
        const allCommands = await vscode.commands.getCommands();
        // 2. 验证我们的命令是否已注册
        expect(allCommands.includes(CREATE_COMPONENT_COMMAND)).to.be.true;
    });
});
