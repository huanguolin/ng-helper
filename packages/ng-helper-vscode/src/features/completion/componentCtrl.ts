import {
    isContainsNgFilter,
    getTextInTemplate,
    getBeforeCursorText,
    Cursor,
    getTheAttrWhileCursorAtValue,
    getHtmlTagByCursor,
} from '@ng-helper/shared/lib/html';
import { languages, TextDocument, Position, CompletionItem, CompletionList } from 'vscode';

import { getComponentControllerAs } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr } from '../utils';

export function componentCtrl(port: number) {
    return languages.registerCompletionItemProvider('html', {
        async provideCompletionItems(document: TextDocument, position: Position) {
            try {
                return await provideCtrlCompletion({ document, position, port });
            } catch (error) {
                console.error('provideCtrlCompletion() error:', error);
                return undefined;
            }
        },
    });
}

async function provideCtrlCompletion({ document, position, port }: { document: TextDocument; position: Position; port: number }) {
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
            return await getComponentControllerAsCompletion(document, port);
        }
    }

    // 组件属性值中 或者 ng-* 属性值中
    const tag = getHtmlTagByCursor(docText, cursor);
    if (tag) {
        const attr = getTheAttrWhileCursorAtValue(tag, cursor);
        if (attr && (isComponentTag(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
            return await getComponentControllerAsCompletion(document, port);
        }
    }
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
