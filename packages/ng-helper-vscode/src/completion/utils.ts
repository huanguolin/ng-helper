import { isInStartTagAnd, canCompletionInStartTag } from "@ng-helper/utils/lib/html";
import * as vscode from "vscode";

export function isComponentHtml(document: vscode.TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function buildNgHelperTsPluginCmd(cmdType: 'component', range: vscode.Range) {
    return {
        id: '@ng-helper/typescript-plugin',
        cmdType,
        range,
    };
}

export function isInStartTagAndCanCompletion(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionInStartTag);
}

