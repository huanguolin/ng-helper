import { languages, TextDocument, Position, Range, CompletionItem, CompletionList } from "vscode";
import { ensureTsServerRunning, isComponentHtml, isInStartTagAndCanCompletionNgX } from "./utils";
import { canCompletionNgDirective, isInStartTagAnd, isInTemplate } from "@ng-helper/shared/lib/html";
import { getComponentControllerAs } from "../service/api";

export function ngCompletion(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: TextDocument, position: Position) {
                if (!isComponentHtml(document)) {
                    return;
                }

                const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
                if (isInStartTagAndCanCompletionNgX(textBeforeCursor)) {
                    // TODO improve
                    return getNgDirectiveList().map(x => new CompletionItem(x));
                }

                if (isInTemplate(textBeforeCursor)) {
                    return getComponentControllerAsCompletion(document, port);
                }
            }
        }
    );
}

async function getComponentControllerAsCompletion(document: TextDocument, port: number) {
    // remove .html add .ts
    const tsFilePath = document.fileName.slice(0, -5) + '.ts';

    await ensureTsServerRunning(tsFilePath, port);

    const res = await getComponentControllerAs(port, { fileName: tsFilePath });
    if (res) {
        return new CompletionList([new CompletionItem(res)], false);
    }
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

