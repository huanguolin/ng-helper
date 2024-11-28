import type { CursorAtTextInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE } from '@ng-helper/shared/lib/html';
import { NgComponentNameInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase, kebabCase } from 'change-case';
import { CompletionItem, CompletionList, SnippetString } from 'vscode';

import { EXT_MARK } from '../../constants';
import { getComponentNameCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getComponentName, getControllerNameInfo, getCorrespondingScriptFileName, isComponentTagName } from '../utils';

import type { CompletionParamObj } from '.';

export async function componentNameCompletion({
    document,
    cursorAtInfo,
    vscodeCancelToken,
    context,
    port,
}: CompletionParamObj<CursorAtTextInfo>) {
    // working on: no triggerChar or triggerChar is '<'
    if (typeof context.triggerCharacter === 'undefined' || context.triggerCharacter === '<') {
        return await componentNameCompletionImpl();
    }

    async function componentNameCompletionImpl() {
        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!(await checkNgHelperServerRunning(relatedScriptFile, port))) {
            return;
        }

        let list = await getComponentNameCompletionApi({
            port,
            info: { fileName: relatedScriptFile },
            vscodeCancelToken,
        });
        if (!list || !list.length) {
            return;
        }

        const currentComponentName = getComponentName(document);
        if (currentComponentName) {
            list = list.filter((x) => x.componentName !== currentComponentName);
        }

        let matchTransclude: NgComponentNameInfo | undefined;
        // 光标在一个标签下，尝试找到这个标签的 transclude 信息。
        if (cursorAtInfo.parentTagName && isComponentTagName(cursorAtInfo.parentTagName)) {
            const i = list.findIndex((x) => x.componentName === camelCase(cursorAtInfo.parentTagName!) && x.transclude);
            if (i >= 0) {
                matchTransclude = list[i];
                list.splice(i, 1);
            }
        }

        const preChar = context.triggerCharacter === '<' ? '' : '<';
        const items = list.map((x) => buildCompletionItem(x));

        if (matchTransclude && matchTransclude.transclude && typeof matchTransclude.transclude !== 'boolean') {
            let transcludeItems = Object.values(matchTransclude.transclude).map((x) => x.replaceAll('?', ''));

            // 移除已经存在的兄弟节点
            if (cursorAtInfo.siblingTagNames.length) {
                transcludeItems = transcludeItems.filter(
                    (componentName) => !cursorAtInfo.siblingTagNames.some((name) => camelCase(name) === componentName),
                );
            }

            // 构建补全项目，并排在最前面
            const preferItems = transcludeItems.map((x, i) => {
                const info: NgComponentNameInfo = { componentName: x, transclude: true };
                const item = buildCompletionItem(info);
                item.sortText = i.toString().padStart(2, '0');
                return item;
            });
            items.unshift(...preferItems);
        }

        return new CompletionList(items, false);

        function buildCompletionItem(x: NgComponentNameInfo): CompletionItem {
            const tag = kebabCase(x.componentName);
            const item = new CompletionItem(tag);
            item.insertText = new SnippetString(buildSnippet());
            item.documentation = buildDocumentation();
            item.detail = EXT_MARK;
            return item;

            function buildSnippet() {
                return buildCore('$0', preChar);
            }

            function buildDocumentation() {
                return buildCore(' | ', '<');
            }

            function buildCore(cursor: string, prefixChar: string) {
                if (x.transclude) {
                    if (typeof x.transclude === 'object') {
                        const requiredItems = Object.values(x.transclude)
                            .filter((x) => !x.includes('?'))
                            .map((x) => kebabCase(x));
                        const indent = SPACE.repeat(4);
                        if (requiredItems.length) {
                            const children = requiredItems.map((x) => `${indent}<${x}></${x}>`).join('\n');
                            return `${prefixChar}${tag}${cursor}>\n${children}\n</${tag}>`;
                        }
                    }
                    return `${prefixChar}${tag}>${cursor}</${tag}>`;
                } else {
                    return `${prefixChar}${tag}${cursor}></${tag}>`;
                }
            }
        }
    }
}
