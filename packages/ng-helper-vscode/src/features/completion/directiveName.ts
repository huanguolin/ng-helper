import type { CursorAtAttrNameInfo, CursorAtStartTagInfo } from '@ng-helper/shared/lib/cursorAt';
import { camelCase, kebabCase } from 'change-case';
import { CompletionList, CancellationToken, CompletionItem, SnippetString, CompletionItemKind } from 'vscode';

import { getDirectiveCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getControllerNameInfo, getCorrespondingScriptFileName } from '../utils';

import { defaultNgConfigExpr, getNgDirectiveConfigList } from './builtinDirectiveHelper';
import { configToCompletionItem } from './builtinDirectiveHelper';

import type { CompletionParamObj } from '.';

export async function directiveNameCompletion({
    document,
    cursorAtInfo,
    vscodeCancelToken,
    context,
    port,
    noRegisterTriggerChar,
}: CompletionParamObj<CursorAtAttrNameInfo>) {
    // 只走没有设置触发字符的那个分支。
    if (noRegisterTriggerChar && typeof context.triggerCharacter === 'undefined') {
        const builtInAttrItems = genBuiltInDirectiveCompletionItem();

        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!(await checkNgHelperServerRunning(relatedScriptFile, port))) {
            return builtInAttrItems;
        }

        return await handleDirectiveName({
            relatedScriptFile,
            cursorAtInfo,
            port,
            vscodeCancelToken,
            builtInAttrItems,
        });
    }
}

async function handleDirectiveName({
    relatedScriptFile,
    cursorAtInfo,
    port,
    vscodeCancelToken,
    builtInAttrItems,
}: {
    relatedScriptFile: string;
    cursorAtInfo: CursorAtStartTagInfo | CursorAtAttrNameInfo;
    port: number;
    vscodeCancelToken: CancellationToken;
    builtInAttrItems: CompletionItem[];
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
    return new CompletionList(
        list
            .map((x, i) => {
                const directiveName = kebabCase(x.name);
                const item = new CompletionItem(directiveName, CompletionItemKind.Property);
                item.insertText = new SnippetString(`${directiveName}$0`);
                item.documentation = ['(directive)', x.typeString && `type: ${x.typeString}`, x.document]
                    .filter(Boolean)
                    .join('\n');
                item.detail = '[ng-helper]';
                item.sortText = i.toString().padStart(2, '0');
                return item;
            })
            .concat(builtInAttrItems),
        false,
    );
}

function genBuiltInDirectiveCompletionItem(): CompletionItem[] {
    return getNgDirectiveConfigList()
        .map(([name, configs]) =>
            configs.length > 0
                ? configs.map((c) => configToCompletionItem(name, c))
                : [configToCompletionItem(name, defaultNgConfigExpr)],
        )
        .flat()
        .map((item, index) => {
            item.sortText = index.toString().padStart(3, '0');
            return item;
        });
}
