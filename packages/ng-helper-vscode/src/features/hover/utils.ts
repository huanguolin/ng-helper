import {
    type Cursor,
    getTextInTemplate,
    getHtmlTagByCursor,
    getTheAttrWhileCursorAtValue,
    indexOfNgFilter,
    getMapValues,
    type HtmlAttr,
} from '@ng-helper/shared/lib/html';
import type { TextDocument, Position } from 'vscode';

import { isValidIdentifier, isComponentTagName, isNgDirectiveAttr, checkServiceAndGetTsFilePath, isNgCustomAttr } from '../utils';

export async function provideTypeHoverInfo<T>({
    document,
    position,
    port,
    api,
}: {
    document: TextDocument;
    position: Position;
    port: number;
    api: (tsFilePath: string, contextString: string, cursorAt: number) => Promise<T | undefined>;
}): Promise<T | undefined> {
    const docText = document.getText();
    const cursor: Cursor = { at: document.offsetAt(position), isHover: true };

    const theChar = docText[cursor.at];
    if (!isValidIdentifier(theChar)) {
        return;
    }

    // 模版 {{}} 中
    const tplText = getTextInTemplate(docText, cursor);
    if (tplText) {
        const cursorAt = tplText.cursor.at;
        const contextString = trimFilters(tplText.text, cursorAt);
        if (contextString) {
            return await callApi(contextString, cursorAt);
        }
    }

    // 组件属性值中 或者 ng-* 属性值中
    const tag = getHtmlTagByCursor(docText, cursor);
    if (tag) {
        const attr = getTheAttrWhileCursorAtValue(tag, cursor);
        if (attr && attr.value && (isComponentTagName(tag.tagName) || isNgDirectiveAttr(attr.name.text) || isNgCustomAttr(attr.name.text))) {
            let cursorAt = cursor.at - attr.value.start;
            let contextString = trimFilters(attr.value.text, cursorAt);
            // handle ng-class/ng-style map value
            ({ contextString, cursorAt } = handleMapAttrValue(attr, contextString, cursorAt));
            return await callApi(contextString, cursorAt);
        }
    }

    async function callApi(contextString: string, cursorAt: number) {
        const tsFilePath = await checkServiceAndGetTsFilePath(document, port);

        if (!tsFilePath) {
            return;
        }

        return await api(tsFilePath, contextString, cursorAt);
    }
}

// 特殊处理:
// 输入：xxx | filter
// 输出：xxx
function trimFilters(contextString: string, cursorAt: number): string {
    const index = indexOfNgFilter(contextString);
    if (index < 0) {
        return contextString;
    }

    if (index <= cursorAt) {
        return '';
    }

    return contextString.slice(0, index);
}

function handleMapAttrValue(attr: HtmlAttr, contextString: string, cursorAt: number) {
    if (attr.name.text === 'ng-class' || attr.name.text === 'ng-style') {
        const mapValues = getMapValues(contextString);
        if (mapValues && mapValues.length) {
            const hoveredValue = mapValues.find((v) => v.start <= cursorAt && cursorAt <= v.start + v.text.length);
            if (hoveredValue) {
                contextString = hoveredValue.text;
                cursorAt = cursorAt - hoveredValue.start;
            }
        }
    }
    return { contextString, cursorAt };
}
