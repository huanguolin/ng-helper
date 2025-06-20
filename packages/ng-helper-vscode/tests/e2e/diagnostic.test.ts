import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import { APP_PAGES_P5_HTML_PATH, CHECK_TIME_DIRECTIVE_JS_PATH } from '../testConstants';
import { activate, setupChaiSnapshotPlugin, sleep } from '../testUtils';

describe('Diagnostic', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate(1);
    });

    it('html diagnostic', async () => {
        await testSemantic(APP_PAGES_P5_HTML_PATH);
    });

    it('inline html diagnostic', async () => {
        await testSemantic(CHECK_TIME_DIRECTIVE_JS_PATH);
    });
});

async function testSemantic(filePath: string, waitSeconds?: number) {
    const uri = vscode.Uri.file(filePath);

    // show the document
    await vscode.window.showTextDocument(uri);
    if (waitSeconds) {
        await sleep(waitSeconds * 1000);
    }

    const diagnostics = vscode.languages.getDiagnostics(uri);

    // assert
    expect(diagnostics.length).to.be.greaterThan(0);
    expect(diagnostics).toMatchSnapshot();
}
