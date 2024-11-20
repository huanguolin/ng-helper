import * as path from 'path';

import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';
import * as vscode from 'vscode';

import { BAR_FOO_COMPONENT_HTML_PATH, BAR_FOO_COMPONENT_TS_PATH, COMPLETION_COMMAND } from './testConstants';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
const chai = require('chai');

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupChaiSnapshotPlugin() {
    // workaround for chai snapshot plugin
    // see https://github.com/mochiya98/mocha-chai-jest-snapshot/issues/16#issuecomment-1537182345
    chai.use(
        jestSnapshotPlugin({
            resolver: path.resolve(__dirname, 'snapshotResolver.js'),
        }),
    );
}

export async function activate() {
    // enable tsserver
    await vscode.window.showTextDocument(vscode.Uri.file(BAR_FOO_COMPONENT_TS_PATH), { preview: false });
    await sleep(1000);

    // show the document
    await vscode.window.showTextDocument(vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH));
    await waitForCompletionToBeAvailable(20);
}

async function waitForCompletionToBeAvailable(maxSeconds: number) {
    let tries = 0;
    while (tries < maxSeconds) {
        const position = new vscode.Position(0, 9);
        // For a complete list of standard commands, see
        // https://code.visualstudio.com/api/references/commands
        const completion = await vscode.commands.executeCommand<vscode.CompletionList>(
            COMPLETION_COMMAND,
            vscode.Uri.file(BAR_FOO_COMPONENT_HTML_PATH),
            position,
            ' ', // space to trigger completion
        );
        if (completion && completion.items.length > 0) {
            return;
        }
        tries++;
        await sleep(1000);
    }
}
