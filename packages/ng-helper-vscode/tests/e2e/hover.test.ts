import * as assert from 'assert';

import { suite, test, suiteSetup } from 'mocha';
import * as vscode from 'vscode';

import { BAR_FOO_COMPONENT_HTML_PATH, HOVER_COMMAND } from '../testConstants';

import { activate } from './helper';

suite('Hover', () => {
    suiteSetup(async () => {
        await activate();
    });

    test('Should show hover info on component name', async () => {
        // show the document
        await vscode.window.showTextDocument(vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH));

        // get hover info
        const hoverInfoList = await vscode.commands.executeCommand<vscode.Hover[]>(
            HOVER_COMMAND,
            vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH),
            new vscode.Position(0, 2),
        );

        // assert
        assert.ok(hoverInfoList?.length > 0, 'hover info should be returned');
    });
});
