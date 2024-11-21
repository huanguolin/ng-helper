import type { CursorAtStartTagInfo } from '@ng-helper/shared/lib/cursorAt';
import { Cursor, SPACE, canCompletionHtmlAttr } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import { CompletionList, CancellationToken, CompletionItem, SnippetString, CompletionItemKind } from 'vscode';

import { getComponentAttrCompletionApi, getDirectiveCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getControllerNameInfo, getCorrespondingScriptFileName, isComponentTagName } from '../utils';

import { defaultNgConfigExpr, getNgDirectiveConfigList } from './builtinDirectiveHelper';
import { configToCompletionItem } from './builtinDirectiveHelper';

import type { CompletionParamObj } from '.';

export async function componentOrDirectiveAttrCompletion({
    document,
    cursor,
    cursorAtInfo,
    vscodeCancelToken,
    context,
    port,
    noRegisterTriggerChar,
}: CompletionParamObj<CursorAtStartTagInfo>) {
    if (
        (!noRegisterTriggerChar && context.triggerCharacter === SPACE) ||
        (noRegisterTriggerChar && typeof context.triggerCharacter === 'undefined')
    ) {
        const tagTextBeforeCursor = document.getText().slice(cursorAtInfo.start, cursor.at);
        if (!canCompletionHtmlAttr(tagTextBeforeCursor)) {
            return;
        }

        let builtInAttrItems: CompletionItem[] = [];
        // 避免在 inline template 中扰乱 component attr 的 completion
        if (!context.triggerCharacter) {
            builtInAttrItems = genBuiltInDirectiveCompletionItem();
        }

        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!(await checkNgHelperServerRunning(relatedScriptFile, port))) {
            return builtInAttrItems;
        }

        if (isComponentTagName(cursorAtInfo.tagName)) {
            return await handleComponent({
                relatedScriptFile,
                cursorAtInfo,
                port,
                vscodeCancelToken,
                builtInAttrItems,
            });
        } else {
            return await handleDirective({
                relatedScriptFile,
                cursorAtInfo,
                cursor,
                port,
                vscodeCancelToken,
                queryType:
                    context.triggerCharacter === SPACE && cursorAtInfo.attrNames.length ? 'directiveAttr' : 'directive',
                builtInAttrItems,
            });
        }
    }
}

async function handleComponent({
    relatedScriptFile,
    cursorAtInfo,
    port,
    vscodeCancelToken,
    builtInAttrItems,
}: {
    relatedScriptFile: string;
    cursorAtInfo: CursorAtStartTagInfo;
    port: number;
    vscodeCancelToken: CancellationToken;
    builtInAttrItems: CompletionItem[];
}) {
    let list = await getComponentAttrCompletionApi({
        port,
        info: { fileName: relatedScriptFile, componentName: camelCase(cursorAtInfo.tagName) },
        vscodeCancelToken,
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

    return new CompletionList(
        list
            .map((x, i) => {
                const item = new CompletionItem(x.name, CompletionItemKind.Field);
                item.insertText = new SnippetString(`${x.name}="$1"$0`);
                item.documentation = `type: ${x.typeString}\n` + x.document;
                item.detail = '[ng-helper]';
                item.sortText = i.toString().padStart(2, '0');
                return item;
            })
            .concat(builtInAttrItems),
        false,
    );
}

async function handleDirective({
    relatedScriptFile,
    cursorAtInfo,
    cursor,
    port,
    queryType,
    vscodeCancelToken,
    builtInAttrItems,
}: {
    relatedScriptFile: string;
    cursorAtInfo: CursorAtStartTagInfo;
    cursor: Cursor;
    port: number;
    queryType: 'directive' | 'directiveAttr';
    vscodeCancelToken: CancellationToken;
    builtInAttrItems: CompletionItem[];
}) {
    const afterCursorAttrName =
        Object.entries(cursorAtInfo.attrLocations)
            .sort(([_a, locA], [_b, locB]) => locA.start - locB.start)
            .find(([_, loc]) => loc.start > cursor.at)?.[0] ?? '';

    const list = await getDirectiveCompletionApi({
        port,
        info: {
            fileName: relatedScriptFile,
            attrNames: cursorAtInfo.attrNames.map((x) => camelCase(x)),
            afterCursorAttrName: camelCase(afterCursorAttrName),
            queryType,
        },
        vscodeCancelToken,
    });
    if (!list || !list.length) {
        return;
    }

    const isDirectiveAttr = queryType === 'directiveAttr';
    return new CompletionList(
        list
            .map((x, i) => {
                const directiveName = kebabCase(x.name);
                const item = new CompletionItem(
                    directiveName,
                    isDirectiveAttr ? CompletionItemKind.Field : CompletionItemKind.Property,
                );
                item.insertText = new SnippetString(isDirectiveAttr ? `${directiveName}="$1"$0` : `${directiveName}$0`);
                item.documentation = [
                    isDirectiveAttr ? '(attribute of directive)' : '(directive)',
                    x.typeString && `type: ${x.typeString}`,
                    x.document,
                ]
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