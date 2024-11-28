import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import type { TextDocument } from 'vscode';

import {
    isComponentTagName,
    isNgBuiltinDirective,
    checkServiceAndGetScriptFilePath,
    isNgUserCustomAttr,
    getContextString,
} from '../utils';

type OnHoverFilterName<T> = (filterName: string, scriptFilePath?: string) => Promise<T | undefined>;
type OnHoverType<T> = (scriptFilePath: string, contextString: string, cursorAt: number) => Promise<T | undefined>;

export async function onTypeHover<T>({
    document,
    cursorAtInfo,
    port,
    onHoverFilterName,
    onHoverType,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo;
    port: number;
    onHoverFilterName: OnHoverFilterName<T>;
    onHoverType: OnHoverType<T>;
}): Promise<T | undefined> {
    const contextString = getContextString(cursorAtInfo);
    switch (contextString.type) {
        case 'none':
        case 'literal':
            // do nothing
            return;
        case 'filterName':
            return await checkAndCallHandler(contextString.value, true);
        case 'identifier':
        case 'propertyAccess':
            return await checkAndCallHandler(contextString.value);
    }

    async function checkAndCallHandler(contextString: string, isFilterName?: boolean) {
        if (!contextString) {
            return;
        }

        if (isFilterName) {
            const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
            return await onHoverFilterName(contextString, scriptFilePath);
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
                return await onHoverType(scriptFilePath, contextString, cursorAt);
            }
        }
    }
}
