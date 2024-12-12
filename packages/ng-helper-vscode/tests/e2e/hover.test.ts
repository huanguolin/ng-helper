import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import {
    APP_PAGES_P1_HTML_PATH,
    APP_PAGES_P4_HTML_PATH,
    BAR_FOO_COMPONENT_HTML_PATH,
    DRAG_SOURCE_COMPONENT_TS_PATH,
    HOVER_COMMAND,
} from '../testConstants';
import { activate, setupChaiSnapshotPlugin, sleep } from '../testUtils';

describe('Hover', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate();
    });

    describe('component name/attr', () => {
        it('show hover info on component name', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(0, 2));
        });

        it('show hover info on component attr', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(0, 12));
        });
    });

    describe('directive name/attr', () => {
        it('show hover info on directive name', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 7));
        });

        it('show hover info on directive attr', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 20));
        });
    });

    describe('ng-*', () => {
        it('show hover info on "ng-if"', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(2, 7));
        });
    });

    describe('type', () => {
        it('show hover info on "ctrl" (component html)', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(2, 14));
        });

        it('show hover info on "(ctrl.)bar" (component html)', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(2, 18));
        });

        it('show hover info on "ctl" (controller html)', async () => {
            await testHover(APP_PAGES_P1_HTML_PATH, new vscode.Position(1, 12));
        });

        it('show hover info on "(ctl.obj.)arr" (controller html)', async () => {
            await testHover(APP_PAGES_P1_HTML_PATH, new vscode.Position(2, 33));
        });
    });

    describe('filter', () => {
        // builtin
        it('show hover info on "translate"', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(2, 42));
        });

        // custom
        it('show hover info on "status"', async () => {
            await testHover(BAR_FOO_COMPONENT_HTML_PATH, new vscode.Position(1, 81));
        });

        // in not component/controller html
        it('show hover info on "status" (not component/controller html)', async () => {
            await testHover(APP_PAGES_P4_HTML_PATH, new vscode.Position(3, 21));
        });
    });

    describe('inline html', () => {
        it('hover component name', async () => {
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(29, 10));
        });

        it('hover component attr', async () => {
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(29, 24));
        });

        it('hover directive name', async () => {
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(30, 15));
        });

        it('hover directive attr', async () => {
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(30, 27));
        });

        it('hover ng-*', async () => {
            // ng-modal
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(30, 42));
        });

        it('hover type', async () => {
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(31, 71));
        });

        it('hover filter', async () => {
            await testHover(DRAG_SOURCE_COMPONENT_TS_PATH, new vscode.Position(30, 62));
        });
    });
});

async function testHover(filePath: string, position: vscode.Position, waitSeconds?: number) {
    // show the document
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    if (waitSeconds) {
        await sleep(waitSeconds * 1000);
    }

    // get hover info
    const hoverInfoList = await vscode.commands.executeCommand<vscode.Hover[]>(
        HOVER_COMMAND,
        vscode.Uri.file(filePath),
        position,
    );

    // assert
    expect(hoverInfoList.length).to.be.greaterThan(0);
    // 必须这样，否则序列化出来的不正确
    const content = hoverInfoList[0].contents[0];
    const markdownString = typeof content === 'string' ? content : content.value;
    expect(markdownString).toMatchSnapshot();
}
