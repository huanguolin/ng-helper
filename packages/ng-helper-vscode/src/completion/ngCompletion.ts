import * as vscode from "vscode";
import { isComponentHtml } from "./utils";


export function ngCompletion() {
    return vscode.languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                if (!isComponentHtml(document)
                    || !isInStartTagAndCanCompletion(document, position)) {
                    return undefined;
                }

                return getNgDirectiveList()
                    .map(x => new vscode.CompletionItem(x));
            }
        }
    );
}

function isInStartTagAndCanCompletion(document: vscode.TextDocument, position: vscode.Position) {
    const beforeText = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    const lastStartTagStart = beforeText.lastIndexOf('<');
    const lastEndTagStart = beforeText.lastIndexOf('</');
    // |
    // |<>
    // </|
    if (lastStartTagStart < 0
        || lastEndTagStart >= lastStartTagStart) {
        return false;
    }

    // > or />
    const lastStartTagEnd = beforeText.lastIndexOf('>');
    // >|
    // />|
    if (lastStartTagEnd > lastStartTagStart) {
        return false;
    }

    /**
     * ><|
     * /><|
     * <|
     */

    // TODO can completion detect
    const tagInnerText = beforeText.slice(lastStartTagStart);
    return lastStartTagEnd < lastStartTagStart;
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
