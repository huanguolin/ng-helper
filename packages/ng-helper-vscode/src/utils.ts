import { normalize } from 'node:path';

import { window, workspace, Uri } from 'vscode';

import { checkNgHelperServerRunningApi } from './service/api';

let tsRunning = false;
export async function checkNgHelperServerRunning(tsFilePath: string, port: number): Promise<boolean> {
    if (tsRunning) {
        return true;
    }

    tsRunning = await checkNgHelperServerRunningApi(port);
    if (tsRunning) {
        // Mark ts server running
        tsRunning = true;
        return true;
    }

    await triggerTsServerByProject(tsFilePath);
    return false;
}

export async function triggerTsServerByProject(tsFilePath: string) {
    if (await isFileExistsOnWorkspace(Uri.file(tsFilePath))) {
        const selection = await window.showErrorMessage(
            "To access features like auto-completion, you need to open a TypeScript file at least once per project. Otherwise, the relevant information won't be available. Click 'OK' and we will automatically open one for you.",
            'OK',
        );
        if (selection === 'OK') {
            // 目前只能通过打开 ts 文档来确保，tsserver 真正运行起来，这样插件才能跑起来。
            const document = await workspace.openTextDocument(Uri.file(tsFilePath));
            await window.showTextDocument(document);
        }
    }
}

export async function isFileExistsOnWorkspace(fileUri: Uri): Promise<boolean> {
    try {
        // 文件不存在会 throw error
        // 为什么不用 node.js 的 fs 方法？因为它们没有考虑 remote file 等情况。
        await workspace.fs.stat(fileUri);
        return true;
    } catch {
        return false;
    }
}

export function normalizeFileExt(ext: string): string {
    if (ext.startsWith('.')) {
        return ext.slice(1);
    }
    return ext;
}

export function normalizePath(filePath: string): string {
    filePath = normalize(filePath);
    return filePath.replace(/\\/g, '/');
}
