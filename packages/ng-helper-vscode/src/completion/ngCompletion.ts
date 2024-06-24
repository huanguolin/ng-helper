import { languages, TextDocument, Position, Range, CompletionItem } from "vscode";
import { isComponentHtml, isInStartTagAndCanCompletionNgX } from "./utils";
import { canCompletionNgDirective, isInStartTagAnd, isInTemplate } from "@ng-helper/shared/lib/html";

export function ngCompletion() {
    return languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: TextDocument, position: Position) {
                if (!isComponentHtml(document)) {
                    return;
                }

                const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
                if (isInStartTagAndCanCompletionNgX(textBeforeCursor)) {
                    return getNgDirectiveList()
                        .map(x => new CompletionItem(x));
                }

                if (isInTemplate(textBeforeCursor)) {
                    return [new CompletionItem('ctrl')];
                }
            }
        }
    );
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

