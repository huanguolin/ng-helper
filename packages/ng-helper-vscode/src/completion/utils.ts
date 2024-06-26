import { isInStartTagAnd, canCompletionNgDirective } from "@ng-helper/shared/lib/html";
import { TextDocument, Range, languages, commands, Position } from "vscode";

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function isInStartTagAndCanCompletionNgX(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}


