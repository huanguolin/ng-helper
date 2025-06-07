import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import type { MinNgSyntaxInfo } from '@ng-helper/shared/lib/minNgSyntax';
import type { TextDocument } from 'vscode';

import { logger } from '../../logger';
import {
    isComponentTagName,
    isNgBuiltinDirective,
    isNgUserCustomAttr,
    getContextString,
    getCorrespondingScriptFileName,
} from '../utils';

type OnHoverFilterName<T> = (filterName: string, scriptFilePath?: string) => Promise<T | undefined>;
type OnHoverType<T> = (
    scriptFilePath: string,
    contextString: string,
    cursorAt: number,
    hoverPropName?: string,
) => Promise<T | undefined>;
type OnHoverLocalType<T> = (locationNgSyntaxInfo: MinNgSyntaxInfo) => T | undefined;

export async function onTypeHover<T>({
    type,
    document,
    cursorAtInfo,
    onHoverFilterName,
    onHoverType,
    onHoverLocalType,
}: {
    type: 'hover' | 'definition';
    document: TextDocument;
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo;
    onHoverFilterName: OnHoverFilterName<T>;
    onHoverType: OnHoverType<T>;
    onHoverLocalType?: OnHoverLocalType<T>;
}): Promise<T | undefined> {
    const contextString = getContextString(cursorAtInfo);
    switch (contextString.type) {
        case 'none':
        case 'literal':
            // do nothing
            return;
        case 'filterName':
            return await checkAndCallHandler(true);
        case 'identifier':
        case 'propertyAccess':
            return await checkAndCallHandler();
    }

    async function checkAndCallHandler(isFilterName?: boolean) {
        if (!contextString.value) {
            return;
        }

        if (isFilterName) {
            const scriptFilePath = await getCorrespondingScriptFileName(document);
            return await onHoverFilterName(contextString.value, scriptFilePath);
        }

        // typeString 给 hover 用。
        // location 给 definition 用。
        if (onHoverLocalType && (type === 'hover' ? contextString.typeString : contextString.location)) {
            logger.logInfo('onTypeHover(): onHoverLocalType: ', contextString);
            return onHoverLocalType(contextString);
        }

        // 如果没有返回 cursorAt 信息，直接取最后一个字符的位置。
        // 只要 getMinNgSyntaxInfo 没有问题，这里的处理就没问题。
        const cursorAt = contextString.cursorAt ?? contextString.value.length - 1;

        const isTemplateValue = cursorAtInfo.type === 'template';
        const isAttrValueAndCompletable =
            cursorAtInfo.type === 'attrValue' &&
            (isComponentTagName(cursorAtInfo.tagName) ||
                isNgBuiltinDirective(cursorAtInfo.attrName) ||
                isNgUserCustomAttr(cursorAtInfo.attrName));
        if (isTemplateValue || isAttrValueAndCompletable) {
            const scriptFilePath = await getCorrespondingScriptFileName(document);
            if (scriptFilePath) {
                return await onHoverType(scriptFilePath, contextString.value, cursorAt, contextString.hoverPropName);
            }
        }
    }
}
