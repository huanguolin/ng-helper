import {
    isContainsNgFilter,
    getTagAndTheAttrNameWhenInAttrValue,
    isInStartTagAnd,
    getTextInTemplate,
    TagAndCurrentAttrName,
    getBeforeCursorText,
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

            const docText = document.getText();
            const offset = document.offsetAt(position);
            const tplText = getTextInTemplate(docText, offset);
            if (tplText) {
                const prefix = getBeforeCursorText(tplText);
                if (prefix && !isContainsNgFilter(prefix)) {
                    return getComponentControllerAsCompletion(document, port);
                }
            }

            const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
            let tagInfo: TagAndCurrentAttrName | undefined = undefined;
            const isInStartTag = isInStartTagAnd(textBeforeCursor, (tagTextBeforeCursor) => {
                tagInfo = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
                return Boolean(tagInfo.tagName && tagInfo.attrName);
            });
            if (isInStartTag && tagInfo) {
                const { tagName, attrName } = tagInfo;
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
