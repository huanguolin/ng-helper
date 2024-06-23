import { isInStartTagAnd, canCompletionNgDirective } from "@ng-helper/shared/lib/html";
import { TextDocument, Range, languages, workspace } from "vscode";

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function isInStartTagAndCanCompletionNgX(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}

let tsRunning = false;
export async function ensureTsServerRunning(tsFilePath: string) {
    if (tsRunning) {
        return;
    }

    const doc = await workspace.openTextDocument(tsFilePath);
    // this will make sure tsserver running
    await languages.setTextDocumentLanguage(doc, 'typescript');
    tsRunning = true;
    console.log('====> ensure tsRunning: ', tsRunning);
}

