import {
    isInTemplate_deprecate,
    getTemplateInnerText_deprecate,
    isContainsNgFilter,
    getTagAndTheAttrNameWhenInAttrValue,
    isInStartTagAnd,
    isInDbQuote_deprecate,
} from '@ng-helper/shared/lib/html';
import { languages, TextDocument, Position, CompletionItem, CompletionList, Range } from 'vscode';

import { getComponentControllerAs } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr } from '../utils';

export function componentCtrl(port: number) {
    return languages.registerCompletionItemProvider('html', {
        provideCompletionItems(document: TextDocument, position: Position) {
            if (!isComponentHtml(document)) {
                return undefined;
            }

            const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
            if (isInTemplate_deprecate(textBeforeCursor)) {
                const prefix = getTemplateInnerText_deprecate(textBeforeCursor);
                if (prefix && !isContainsNgFilter(prefix)) {
                    return getComponentControllerAsCompletion(document, port);
                }
            }

            let tagTextBeforeCursor = '';
            if (
                isInStartTagAnd(textBeforeCursor, (innerTagTextBeforeCursor) => {
                    tagTextBeforeCursor = innerTagTextBeforeCursor;
                    return isInDbQuote_deprecate(innerTagTextBeforeCursor);
                })
            ) {
                const { tagName, attrName } = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
                if (isComponentTag(tagName) || isNgDirectiveAttr(attrName)) {
                    return getComponentControllerAsCompletion(document, port);
                }
            }
        },
    });
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
