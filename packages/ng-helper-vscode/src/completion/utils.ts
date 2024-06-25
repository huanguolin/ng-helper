import { isInStartTagAnd, canCompletionNgDirective } from "@ng-helper/shared/lib/html";
import { TextDocument, Range, languages, workspace, commands, Position, Uri, window } from "vscode";
import { healthCheck } from "../service/api";

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function isInStartTagAndCanCompletionNgX(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}

let tsRunning = false;
export async function ensureTsServerRunning(tsFilePath: string, port: number) {
    if (tsRunning) {
        return;
    }

    tsRunning = await healthCheck(port);
    if (tsRunning) {
        return;
    }

    const selection = await window.showWarningMessage(
        "To access features like auto-completion, you need to open a TypeScript file at least once. Otherwise, the relevant information won't be available. Click 'OK' and we will automatically open one for you.",
        'OK');
    if (selection === 'OK') {
        // 目前只能通过打开 ts 文档来确保，tsserver 真正运行起来，这样插件才能跑起来。
        const document = await workspace.openTextDocument(Uri.file(tsFilePath));
        await window.showTextDocument(document);
    }

    tsRunning = true;
}

