import { isInStartTagAnd, canCompletionNgDirective } from "@ng-helper/shared/lib/html";
import { TextDocument, Range } from "vscode";

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function buildNgHelperTsPluginCmd(cmdType: 'component') {
    return {
        id: '@ng-helper/typescript-plugin',
        cmdType,
    };
}

export function isInStartTagAndCanCompletionNgX(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}

