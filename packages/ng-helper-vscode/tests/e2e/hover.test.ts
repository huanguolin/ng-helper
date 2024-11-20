import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import { BAR_FOO_COMPONENT_HTML_PATH, HOVER_COMMAND } from '../testConstants';
import { activate, setupChaiSnapshotPlugin } from '../testUtils';

describe('Hover', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate();
    });

    describe('component name/attr', () => {
        it('show hover info on component name', async () => {
            // show the document
            await vscode.window.showTextDocument(vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH));

            // get hover info
            const hoverInfoList = await vscode.commands.executeCommand<vscode.Hover[]>(
                HOVER_COMMAND,
                vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH),
                new vscode.Position(0, 2),
            );

            // assert
            expect(hoverInfoList.length).to.be.greaterThan(0);
            // 必须这样，否则序列化出来的不正确
            const content = hoverInfoList[0].contents[0];
            const markdownString = typeof content === 'string' ? content : content.value;
            expect(markdownString).toMatchSnapshot();
        });

        it('Should show hover info on component attr', async () => {
            // show the document
            await vscode.window.showTextDocument(vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH));

            // get hover info
            const hoverInfoList = await vscode.commands.executeCommand<vscode.Hover[]>(
                HOVER_COMMAND,
                vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH),
                new vscode.Position(0, 12),
            );

            // assert
            expect(hoverInfoList.length).to.be.greaterThan(0);
            // 必须这样，否则序列化出来的不正确
            const content = hoverInfoList[0].contents[0];
            const markdownString = typeof content === 'string' ? content : content.value;
            expect(markdownString).toMatchSnapshot();
        });
    });
});
