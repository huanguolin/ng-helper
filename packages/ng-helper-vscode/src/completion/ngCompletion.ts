import * as vscode from "vscode";
import { isComponentHtml } from "./utils";


export function ngCompletion() {
    return vscode.languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                if (isComponentHtml(document) && isInStartTag(document, position)) {
                    return getNgDirectiveList()
                        .map(x => new vscode.CompletionItem(x));
                }

                return undefined;
            }
        }
    );
}

function isInStartTag(document: vscode.TextDocument, position: vscode.Position) {
    const beforeText = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const lastStartTag = beforeText.lastIndexOf('<');
    const lastCloseTag = Math.max(beforeText.lastIndexOf('>'), beforeText.lastIndexOf('</'));
    return lastCloseTag < lastStartTag;
}

function getNgDirectiveList() {
    return [
        'ng-click',
        'ng-if',
        'ng-model',
        'ng-class',
        'ng-disabled',
        'ng-show',
        'ng-repeat',
        'ng-init',
        'ng-controller',
        'ng-options',
        'ng-change',
        'ng-pattern',
        'ng-bind',
        'ng-required',
        'ng-maxlength',
        'ng-hide',
        'ng-style',
        'ng-list',
        'ng-dblclick',
        'ng-submit',
        'ng-src',
        'ng-href',
        'ng-checked',
        'ng-include',
        'ng-cloak',
        'ng-transclude',
        'ng-app',
        'ng-value',
        'ng-blur',
        'ng-keypress',
        'ng-selected',
        'ng-readonly',
        'ng-keydown',
        'ng-form',
        'ng-mouseover',
        'ng-mouseleave',
        'ng-mouseenter',
    ];
}
