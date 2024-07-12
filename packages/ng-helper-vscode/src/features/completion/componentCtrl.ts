import {
    isContainsNgFilter,
    getTextInTemplate,
    getBeforeCursorText,
    Cursor,
    getStartTagText,
    getTheAttrWhileCursorAtValue,
    parseStartTagText,
} from '@ng-helper/shared/lib/html';
import { languages, TextDocument, Position, CompletionItem, CompletionList } from 'vscode';

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
            const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

            // 模版 {{}} 中
            const tplText = getTextInTemplate(docText, cursor);
            if (tplText) {
                const prefix = getBeforeCursorText(tplText);
                if (prefix && !isContainsNgFilter(prefix)) {
                    return getComponentControllerAsCompletion(document, port);
                }
            }

            // 组件属性值中 或者 ng-* 属性值中
            const startTagText = getStartTagText(docText, cursor);
            if (startTagText) {
                const startTag = parseStartTagText(startTagText.text, startTagText.start);
                const attr = getTheAttrWhileCursorAtValue(startTag, cursor);
                if (attr && (isComponentTag(startTag.name.text) || isNgDirectiveAttr(attr.name.text))) {
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
