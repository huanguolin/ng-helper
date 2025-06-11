import type { CursorAtAttrNameInfo, CursorAtStartTagInfo } from '@ng-helper/shared/lib/cursorAt';
import { Cursor, SPACE, canCompletionHtmlAttr } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import { CancellationToken, CompletionItem, SnippetString, CompletionItemKind } from 'vscode';

import { EXT_MARK } from '../../constants';
import type { RpcApi } from '../../service/tsService/rpcApi';
import { getControllerNameInfo, getCorrespondingScriptFileName, isComponentTagName } from '../utils';

import type { CompletionParamObj } from '.';

export async function componentOrDirectiveAttrCompletion({
    document,
    cursor,
    cursorAtInfo,
    cancelToken,
    ngContext,
    completionContext,
}: CompletionParamObj<CursorAtStartTagInfo | CursorAtAttrNameInfo>) {
    // 属性补全触发方式有两种: 空格和输入字符。
    if (completionContext.triggerCharacter === SPACE || typeof completionContext.triggerCharacter === 'undefined') {
        if (cursorAtInfo.type === 'startTag') {
            // 只有是 'startTag' 时才需要看这个
            const tagTextBeforeCursor = document.getText().slice(cursorAtInfo.start, cursor.at);
            if (!canCompletionHtmlAttr(tagTextBeforeCursor)) {
                return;
            }
        }

        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!relatedScriptFile) {
            return;
        }

        if (isComponentTagName(cursorAtInfo.tagName)) {
            return await handleComponentAttr({
                relatedScriptFile,
                cursorAtInfo,
                rpcApi: ngContext.rpcApi,
                cancelToken,
            });
        } else {
            return await handleDirectiveAttr({
                relatedScriptFile,
                cursorAtInfo,
                cursor,
                rpcApi: ngContext.rpcApi,
                cancelToken,
            });
        }
    }
}

async function handleComponentAttr({
    relatedScriptFile,
    cursorAtInfo,
    rpcApi,
    cancelToken,
}: {
    relatedScriptFile: string;
    cursorAtInfo: CursorAtStartTagInfo | CursorAtAttrNameInfo;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
}) {
    let list = await rpcApi.getComponentAttrCompletionApi({
        params: { fileName: relatedScriptFile, componentName: camelCase(cursorAtInfo.tagName) },
        cancelToken,
    });
    if (!list || !list.length) {
        return;
    }

    list = list
        .map((x) => {
            x.name = kebabCase(x.name);
            return x;
        })
        .filter((x) => {
            return !cursorAtInfo.attrNames.some((attrName) => attrName === x.name);
        });

    // optional 为 true 的属性放在后面
    list.sort((a, b) => {
        if (a.optional && !b.optional) {
            return 1;
        }
        if (!a.optional && b.optional) {
            return -1;
        }
        return 0;
    });

    return list.map((x, i) => {
        const item = new CompletionItem(x.name, CompletionItemKind.Field);
        item.insertText = new SnippetString(`${x.name}="$1"$0`);
        item.documentation = `type: ${x.typeString}\n` + x.document;
        item.detail = EXT_MARK;
        item.sortText = i.toString().padStart(2, '0');
        return item;
    });
}

async function handleDirectiveAttr({
    relatedScriptFile,
    cursorAtInfo,
    cursor,
    rpcApi,
    cancelToken,
}: {
    relatedScriptFile: string;
    cursorAtInfo: CursorAtStartTagInfo | CursorAtAttrNameInfo;
    cursor: Cursor;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
}) {
    const afterCursorAttrName =
        Object.entries(cursorAtInfo.attrLocations)
            .sort(([_a, locA], [_b, locB]) => locA.start - locB.start)
            .find(([_, loc]) => loc.start > cursor.at)?.[0] ?? '';

    const list = await rpcApi.getDirectiveCompletionApi({
        params: {
            fileName: relatedScriptFile,
            attrNames: cursorAtInfo.attrNames.map((x) => camelCase(x)),
            afterCursorAttrName: camelCase(afterCursorAttrName),
            queryType: 'directiveAttr',
        },
        cancelToken,
    });
    if (!list || !list.length) {
        return;
    }

    return list.map((x, i) => {
        const directiveName = kebabCase(x.name);
        const item = new CompletionItem(directiveName, CompletionItemKind.Field);
        item.insertText = new SnippetString(`${directiveName}="$1"$0`);
        item.documentation = ['(attribute of directive)', x.typeString && `type: ${x.typeString}`, x.document]
            .filter(Boolean)
            .join('\n');
        item.detail = EXT_MARK;
        item.sortText = i.toString().padStart(2, '0');
        return item;
    });
}
