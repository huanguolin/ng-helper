import type { CursorAtAttrNameInfo, CursorAtStartTagInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import { CancellationToken, CompletionItem, SnippetString, CompletionItemKind, MarkdownString } from 'vscode';

import { checkCancellation } from '../../asyncUtils';
import { EXT_MARK } from '../../constants';
import type { NgContext } from '../../ngContext';
import type { RpcApi } from '../../service/tsService/rpcApi';
import { getControllerNameInfo, getCorrespondingScriptFileName } from '../utils';

import { addNgHelperInfoToCompletionItem, type NgHelperCompletionItem } from './utils';

import type { CompletionParamObj } from '.';

export async function customDirectiveNameCompletion({
    document,
    cursorAtInfo,
    cancelToken,
    ngContext,
    completionContext,
}: CompletionParamObj<CursorAtAttrNameInfo>) {
    // 只走没有设置触发字符的那个分支。
    if (typeof completionContext.triggerCharacter === 'undefined') {
        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!relatedScriptFile) {
            return;
        }

        checkCancellation(cancelToken);

        return await handleDirectiveName({
            relatedScriptFile,
            cursorAtInfo,
            rpcApi: ngContext.rpcApi,
            cancelToken,
        });
    }
}

async function handleDirectiveName({
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
    const list = await rpcApi.getDirectiveCompletionApi({
        params: {
            fileName: relatedScriptFile,
            attrNames: cursorAtInfo.attrNames.map((x) => camelCase(x)),
            afterCursorAttrName: '',
            queryType: 'directive',
        },
        cancelToken,
    });
    if (!list || !list.length) {
        return;
    }
    return list.map((x, i) => {
        const directiveName = kebabCase(x.name);
        const item = new CompletionItem(directiveName, CompletionItemKind.Property);
        item.insertText = new SnippetString(`${directiveName}$0`);
        item.documentation = ['(directive)', x.typeString && `type: ${x.typeString}`, x.document]
            .filter(Boolean)
            .join('\n');
        item.detail = EXT_MARK;
        item.sortText = i.toString().padStart(2, '0');
        addNgHelperInfoToCompletionItem(item, {
            type: 'directiveName',
            name: x.name,
            filePath: relatedScriptFile,
        });
        return item;
    });
}

export async function resolveDirectiveName(
    ngContext: NgContext,
    item: NgHelperCompletionItem,
    cancelToken: CancellationToken,
): Promise<CompletionItem> {
    const { filePath, name: directiveName } = item.ngHelperInfo;

    const info = await ngContext.rpcApi.resolveDirectiveInfoApi({
        cancelToken,
        params: {
            fileName: filePath,
            directiveName,
        },
    });
    if (!info) {
        return item;
    }

    if (info.formattedTypeString) {
        const md = new MarkdownString();
        md.appendCodeblock(info.formattedTypeString, 'typescript');
        item.documentation = md;
    }

    if (info.requiredAttrNames.length) {
        const directive = kebabCase(directiveName);

        const attrStr = info.requiredAttrNames.map((x, i) => `${kebabCase(x)}="$${i + 1}"`).join(SPACE);

        item.insertText = new SnippetString(`${directive} ${attrStr}$0`);
    }
    return item;
}
