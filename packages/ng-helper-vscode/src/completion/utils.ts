import { isInStartTagAnd, canCompletionNgDirective } from "@ng-helper/utils/lib/html";
import { TextDocument, Range } from "vscode";

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function buildNgHelperTsPluginCmd(cmdType: 'component', range: Range) {
    return {
        id: '@ng-helper/typescript-plugin',
        cmdType,
        range,
    };
}

export function isInStartTagAndCanCompletionNgX(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}

