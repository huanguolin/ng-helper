import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import {
    APP_PAGES_P2_HTML_PATH,
    BAR_FOO_COMPONENT_HTML_PATH,
    DRAG_SOURCE_COMPONENT_TS_PATH,
    SIGNATURE_HELP_COMMAND,
} from '../testConstants';
import { activate, setupChaiSnapshotPlugin, sleep } from '../testUtils';

describe('SignatureHelp', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate();
    });

    describe('component html', () => {
        it('trigger by "("', async () => {
            await testSignatureHelp({
                filePath: BAR_FOO_COMPONENT_HTML_PATH,
                position: new vscode.Position(7, 16),
                triggerChar: '(',
            });
        });

        it('trigger by ","', async () => {
            await testSignatureHelp({
                filePath: BAR_FOO_COMPONENT_HTML_PATH,
                position: new vscode.Position(9, 25),
                triggerChar: ',',
            });
        });
    });

    describe('controller html', () => {
        it('no argument', async () => {
            await testSignatureHelp({
                filePath: APP_PAGES_P2_HTML_PATH,
                position: new vscode.Position(10, 31),
                triggerChar: '(',
            });
        });

        it('one argument', async () => {
            await testSignatureHelp({
                filePath: APP_PAGES_P2_HTML_PATH,
                position: new vscode.Position(12, 34),
                triggerChar: '(',
            });
        });
    });

    it('inline html', async () => {
        await testSignatureHelp({
            filePath: DRAG_SOURCE_COMPONENT_TS_PATH,
            position: new vscode.Position(40, 30),
            triggerChar: ',',
        });
    });
});

async function testSignatureHelp({
    filePath,
    position,
    triggerChar,
    waitSeconds,
}: {
    filePath: string;
    position: vscode.Position;
    triggerChar?: string;
    waitSeconds?: number;
}) {
    // show the document
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    if (waitSeconds) {
        await sleep(waitSeconds * 1000);
    }

    // get completion info
    const info = await vscode.commands.executeCommand<vscode.SignatureHelp>(
        SIGNATURE_HELP_COMMAND,
        vscode.Uri.file(filePath),
        position,
        triggerChar,
    );

    expect(info).toMatchSnapshot();
}
