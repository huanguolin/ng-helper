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
    tsRunning = await healthCheck(port);
    if (tsRunning) {
        return;
    }

    // 目前只能通过打开 ts 文档来确保，tsserver 真正运行起来，这样插件才能跑起来。
    // 带来的问题是，第一次会打开一个 ts 文件，影响编辑。
    const document = await workspace.openTextDocument(Uri.file(tsFilePath));
    await window.showTextDocument(document);

    tsRunning = true;
    console.log('====> ensure tsRunning: ', tsRunning);
}

