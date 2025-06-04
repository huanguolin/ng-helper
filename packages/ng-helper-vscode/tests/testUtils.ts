import path = require('path');

import chai = require('chai');
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';
import * as vscode from 'vscode';

import { BAR_FOO_COMPONENT_HTML_PATH, BAR_FOO_COMPONENT_TS_PATH, COMPLETION_COMMAND } from './testConstants';

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupChaiSnapshotPlugin() {
    // workaround for chai snapshot plugin
    // see https://github.com/mochiya98/mocha-chai-jest-snapshot/issues/16#issuecomment-1537182345
    chai.use(
        jestSnapshotPlugin({
            snapshotResolver: path.resolve(__dirname, 'snapshotResolver.js'),
            /**
             * fix error:
             * TypeError: Cannot read properties of undefined (reading 'filter')
             * at ScriptTransformer.requireAndTranspileModule (.../node_modules/@jest/transform/build/ScriptTransformer.js:785:12)
             */
            moduleFileExtensions: ['js'],
        }),
    );
}

export async function activate(waitSeconds: number = 1) {
    // enable tsserver
    await vscode.window.showTextDocument(vscode.Uri.file(BAR_FOO_COMPONENT_TS_PATH), { preview: false });
    await sleep(1000 * waitSeconds);

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
