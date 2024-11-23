import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import type { TextDocument } from 'vscode';

import {
    isComponentTagName,
    isNgBuiltinDirective,
    checkServiceAndGetScriptFilePath,
    isNgUserCustomAttr,
    getContextString,
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
    const contextString = getContextString(cursorAtInfo);
    switch (contextString.type) {
        case 'none':
        case 'literal':
            // do nothing
            return;
        case 'filterName':
            // TODO: support filter name hover
            break;
        case 'identifier':
        case 'propertyAccess':
            return await checkAndCallApi(contextString.value);
    }

    async function checkAndCallApi(contextString: string) {
        if (!contextString) {
            return;
        }

        // 这里简单起见，直接取最后一个字符的位置。
        // 只要 getMinNgSyntaxInfo 没有问题，这里的处理就没问题。
        const cursorAt = contextString.length - 1;

        const isTemplateValue = cursorAtInfo.type === 'template';
        const isAttrValueAndCompletable =
            cursorAtInfo.type === 'attrValue' &&
            (isComponentTagName(cursorAtInfo.tagName) ||
                isNgBuiltinDirective(cursorAtInfo.attrName) ||
                isNgUserCustomAttr(cursorAtInfo.attrName));
        if (isTemplateValue || isAttrValueAndCompletable) {
            const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
            if (scriptFilePath) {
                return await api(scriptFilePath, contextString, cursorAt);
            }
        }
    }
}
