import * as vscode from 'vscode';

import { BAR_FOO_COMPONENT_HTML_PATH, BAR_FOO_COMPONENT_TS_PATH, COMPLETION_COMMAND } from '../testConstants';
import { sleep } from '../testUtils';

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
