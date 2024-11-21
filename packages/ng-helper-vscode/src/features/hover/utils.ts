import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import { indexOfNgFilter, getMapValues } from '@ng-helper/shared/lib/html';
import type { TextDocument } from 'vscode';

import {
    isComponentTagName,
    isNgBuiltinDirective,
    checkServiceAndGetScriptFilePath,
    isNgUserCustomAttr,
} from '../utils';

export async function provideTypeHoverInfo<T>({
    document,
    cursorAtInfo,
    port,
    api,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo;
    port: number;
    api: (scriptFilePath: string, contextString: string, cursorAt: number) => Promise<T | undefined>;
}): Promise<T | undefined> {
    let cursorAt = cursorAtInfo.relativeCursorAt;

    if (cursorAtInfo.type === 'template') {
        const contextString = trimFilters(cursorAtInfo.template, cursorAt);
        if (contextString) {
            return await callApi(contextString, cursorAt);
        }
    } else if (cursorAtInfo.type === 'attrValue') {
        if (
            isComponentTagName(cursorAtInfo.tagName) ||
            isNgBuiltinDirective(cursorAtInfo.attrName) ||
            isNgUserCustomAttr(cursorAtInfo.attrName)
        ) {
            let contextString = trimFilters(cursorAtInfo.attrValue, cursorAt);
            // handle ng-class/ng-style map value
            ({ contextString, cursorAt } = handleMapAttrValue(cursorAtInfo.attrName, contextString, cursorAt));
            return await callApi(contextString, cursorAt);
        }
    }

    async function callApi(contextString: string, cursorAt: number) {
        const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);

        if (!scriptFilePath) {
            return;
        }

        return await api(scriptFilePath, contextString, cursorAt);
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

function handleMapAttrValue(attrName: string, contextString: string, cursorAt: number) {
    if (attrName === 'ng-class' || attrName === 'ng-style') {
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
