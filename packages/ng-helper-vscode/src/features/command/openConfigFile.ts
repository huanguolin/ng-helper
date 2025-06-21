import { window, workspace } from 'vscode';

import { getUserConfigFileUri } from '../../config';
import type { NgContext } from '../../ngContext';

import { createCommand } from './utils';

export function openConfigFile(_ngContext: NgContext) {
    return createCommand('openConfigFile', async () => {
        await openNgHelperConfigFile();
    });
}

async function openNgHelperConfigFile() {
    const uri = getUserConfigFileUri();
    if (!uri) {
        return;
    }

    const document = await workspace.openTextDocument(uri);
    await window.showTextDocument(document);
}
