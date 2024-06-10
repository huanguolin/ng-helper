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
