import type { CursorAtAttrNameInfo, CursorAtStartTagInfo } from '@ng-helper/shared/lib/cursorAt';
import { camelCase, kebabCase } from 'change-case';
import { CancellationToken, CompletionItem, SnippetString, CompletionItemKind } from 'vscode';

import { checkCancellation } from '../../asyncUtils';
import { EXT_MARK } from '../../constants';
import { getDirectiveCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getControllerNameInfo, getCorrespondingScriptFileName } from '../utils';

import type { CompletionParamObj } from '.';

export async function customDirectiveNameCompletion({
    document,
    cursorAtInfo,
    vscodeCancelToken,
    context,
    port,
}: CompletionParamObj<CursorAtAttrNameInfo>) {
    // 只走没有设置触发字符的那个分支。
    if (typeof context.triggerCharacter === 'undefined') {
        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!(await checkNgHelperServerRunning(relatedScriptFile, port))) {
            return;
        }

        checkCancellation(vscodeCancelToken);

        return await handleDirectiveName({
            relatedScriptFile,
            cursorAtInfo,
            port,
            vscodeCancelToken,
        });
    }
}

async function handleDirectiveName({
    relatedScriptFile,
    cursorAtInfo,
    port,
    vscodeCancelToken,
}: {
    relatedScriptFile: string;
    cursorAtInfo: CursorAtStartTagInfo | CursorAtAttrNameInfo;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const list = await getDirectiveCompletionApi({
        port,
        info: {
            fileName: relatedScriptFile,
            attrNames: cursorAtInfo.attrNames.map((x) => camelCase(x)),
            afterCursorAttrName: '',
            queryType: 'directive',
        },
        vscodeCancelToken,
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
        return item;
    });
}
