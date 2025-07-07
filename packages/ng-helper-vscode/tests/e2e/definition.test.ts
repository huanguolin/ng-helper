import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import {
    APP_PAGES_P1_HTML_PATH,
    APP_PAGES_P4_HTML_PATH,
    BAR_FOO_COMPONENT_HTML_PATH,
    DEFINITION_COMMAND,
    DRAG_SOURCE_COMPONENT_TS_PATH,
} from '../testConstants';
import { activate, setupChaiSnapshotPlugin, sleep } from '../testUtils';

describe('Definition', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate();
    });

    describe('component name/attr', () => {
        it('get definition info on component name', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(0, 2));
        });

        it('get definition info on component attr', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(0, 12));
        });
    });

    describe('directive name/attr', () => {
        it('get definition info on directive name', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 7));
        });

        it('get definition info on directive attr', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 20));
        });
    });

    describe('type', () => {
        it('get definition info on "ctrl" (component html)', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(2, 14));
        });

        // 括号里的是补充信息，点击在 bar 上
        it('get definition info on "(ctrl.)bar" (component html)', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(2, 18));
        });

        it('get definition info on "ctl" (controller html)', async () => {
            await testDefinition(APP_PAGES_P1_HTML_PATH, new vscode.Position(1, 12));
        });

        // 括号里的是补充信息，点击在 arr 上
        it('get definition info on "(ctl.obj.)arr" (controller html)', async () => {
            await testDefinition(APP_PAGES_P1_HTML_PATH, new vscode.Position(2, 38));
        });
    });

    describe('ng-repeat', () => {
        // 括号里的是补充信息，点击在 item 上
        it('get definition info on "item(.name)" (component html)', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(4, 15));
        });

        // 括号里的是补充信息，点击在 name 上
        it('get definition info on "($first.)name" (component html)', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(4, 48));
        });

        // 括号里的是补充信息，点击在 item 上
        it('get definition info on "item(.name)" (controller html)', async () => {
            await testDefinition(APP_PAGES_P1_HTML_PATH, new vscode.Position(3, 19));
        });

        // 括号里的是补充信息，点击在 name 上
        it('get definition info on "($first.)name" (controller html)', async () => {
            await testDefinition(APP_PAGES_P1_HTML_PATH, new vscode.Position(3, 52));
        });
    });

    describe('filter', () => {
        // ts
        it('get definition info on "status"', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 81));
        });

        // js
        it('get definition info on "f2"', async () => {
            await testDefinition(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 86));
        });

        // in not component/controller html
        it('get definition info on "status" (not component/controller html)', async () => {
            await testDefinition(APP_PAGES_P4_HTML_PATH, new vscode.Position(3, 21));
        });
    });

    describe('inline html', () => {
        it('component name', async () => {
            await testDefinition(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(30, 10));
        });

        it('component attr', async () => {
            await testDefinition(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(30, 24));
        });

        it('directive name', async () => {
            await testDefinition(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(31, 15));
        });

        it('directive attr', async () => {
            await testDefinition(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(31, 27));
        });

        it('type', async () => {
            await testDefinition(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(32, 71));
        });

        it('filter', async () => {
            await testDefinition(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(31, 62));
        });
    });
});

async function testDefinition(filePath: string, position: vscode.Position, waitSeconds?: number) {
    // show the document
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    if (waitSeconds) {
        await sleep(waitSeconds * 1000);
    }

    // get definition info
    const definitionInfoList = await vscode.commands.executeCommand<vscode.Location[]>(
        DEFINITION_COMMAND,
        vscode.Uri.file(filePath),
        position,
    );

    // assert
    expect(definitionInfoList.length).to.be.greaterThan(0);
    // 要移除处理绝对路径问题，否则测试无法跨平台。
    // 方法是移除路径 ng-helper-vscode (含)之前的部分：
    definitionInfoList.forEach((definitionInfo) => {
        const relativePath = definitionInfo.uri.toString().replace(/^.*\/ng-helper-vscode\//, '');
        definitionInfo.uri = vscode.Uri.file(relativePath);
    });
    expect(definitionInfoList).toMatchSnapshot();
}
