import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import {
    APP_PAGES_P3_HTML_PATH,
    NUMBER_CHECK_DIRECTIVE_JS_PATH,
    SEMANTIC_TOKENS_COMMAND,
    SEMANTIC_TOKENS_LEGEND_COMMAND,
} from '../testConstants';
import { activate, setupChaiSnapshotPlugin, sleep } from '../testUtils';

describe('Semantic', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate();
    });

    it('html semantic', async () => {
        await testSemantic(APP_PAGES_P3_HTML_PATH);
    });

    it('inline html semantic', async () => {
        await testSemantic(NUMBER_CHECK_DIRECTIVE_JS_PATH);
    });
});

async function testSemantic(filePath: string, waitSeconds?: number) {
    // show the document
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    if (waitSeconds) {
        await sleep(waitSeconds * 1000);
    }

    // get semantic tokens legend
    const semanticTokensLegend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        SEMANTIC_TOKENS_LEGEND_COMMAND,
        vscode.Uri.file(filePath),
    );

    // get semantic tokens
    const semanticTokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        SEMANTIC_TOKENS_COMMAND,
        vscode.Uri.file(filePath),
    );

    // assert
    expect(semanticTokensLegend.tokenModifiers).to.be.empty;
    expect(semanticTokensLegend.tokenTypes).to.be.deep.equals(['string']);
    expect(semanticTokens.data.length).to.be.greaterThan(0);
    expect(semanticTokens).toMatchSnapshot();
}
