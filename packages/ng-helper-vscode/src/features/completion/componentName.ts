import type { CursorAtTextInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE } from '@ng-helper/shared/lib/html';
import { isComponentTagName } from '@ng-helper/shared/lib/ngUtils';
import { NgComponentNameInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase, kebabCase } from 'change-case';
import { CompletionItem, CompletionList, MarkdownString, SnippetString, type CancellationToken } from 'vscode';

import { checkCancellation } from '../../asyncUtils';
import { EXT_MARK } from '../../constants';
import type { NgContext } from '../../ngContext';
import { getComponentName, getControllerNameInfo, getCorrespondingScriptFileName } from '../utils';

import { addNgHelperInfoToCompletionItem, type NgHelperCompletionItem } from './utils';

import type { CompletionParamObj } from '.';

export async function componentNameCompletion({
    document,
    cursorAtInfo,
    cancelToken,
    ngContext,
    completionContext,
}: CompletionParamObj<CursorAtTextInfo>) {
    // working on: no triggerChar or triggerChar is '<'
    if (typeof completionContext.triggerCharacter === 'undefined' || completionContext.triggerCharacter === '<') {
        return await componentNameCompletionImpl();
    }

    async function componentNameCompletionImpl() {
        const relatedScriptFile =
            (await getCorrespondingScriptFileName(
                document,
                getControllerNameInfo(cursorAtInfo.context)?.controllerName,
            )) ?? document.fileName;
        if (!relatedScriptFile) {
            return;
        }

        checkCancellation(cancelToken);

        let list = await ngContext.rpcApi.getComponentNameCompletionApi({
            params: { fileName: relatedScriptFile },
            cancelToken,
        });
        if (!list || !list.length) {
            return;
        }

        checkCancellation(cancelToken);

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

        const preChar = completionContext.triggerCharacter === '<' ? '' : '<';
        const items = list.map((x) => buildCompletionItem(x, false));

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
                const item = buildCompletionItem(info, true);
                item.sortText = i.toString().padStart(2, '0');
                return item;
            });
            items.unshift(...preferItems);
        }

        return new CompletionList(items, false);

        function buildCompletionItem(x: NgComponentNameInfo, isTransclude: boolean): CompletionItem {
            const tag = kebabCase(x.componentName);
            const item = new CompletionItem(tag);
            item.insertText = new SnippetString(buildSnippet());
            item.documentation = buildDocumentation();
            item.detail = EXT_MARK;
            if (!isTransclude) {
                addNgHelperInfoToCompletionItem(item, {
                    type: 'componentName',
                    name: x.componentName,
                    filePath: relatedScriptFile,
                    prefixChar: preChar,
                });
            }
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
                        const requiredTranscludeItems = Object.values(x.transclude)
                            .filter((x) => !x.includes('?'))
                            .map((x) => kebabCase(x));
                        const indent = SPACE.repeat(4);
                        if (requiredTranscludeItems.length) {
                            const children = requiredTranscludeItems.map((x) => `${indent}<${x}></${x}>`).join('\n');
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

export async function resolveComponentName(
    ngContext: NgContext,
    item: NgHelperCompletionItem,
    cancelToken: CancellationToken,
): Promise<CompletionItem> {
    const { filePath, name: componentName, prefixChar } = item.ngHelperInfo;

    const info = await ngContext.rpcApi.resolveComponentInfoApi({
        cancelToken,
        params: {
            fileName: filePath,
            componentName,
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

    if (info.requiredAttrNames.length || info.requiredTranscludeNames.length) {
        const tag = kebabCase(componentName);

        const attrStr = info.requiredAttrNames.map((x, i) => `${kebabCase(x)}="$${i + 1}"`).join(SPACE);

        const indent = SPACE.repeat(4);
        const transcludeStr = info.requiredTranscludeNames
            .map((x) => `${indent}<${kebabCase(x)}></${kebabCase(x)}>`)
            .join('\n');

        const prefix = prefixChar ?? '';

        // 示例 4 情况:
        // common-button></common-button>
        // <common-button></common-button>
        // <common-button title=""></common-button>
        // <common-panel title="">
        //      <panel-body></panel-body>
        // </common-button>
        let s = prefix + tag;
        if (attrStr) {
            s += SPACE + attrStr;
        }
        s += '$0>';
        if (transcludeStr) {
            s += `\n${transcludeStr}\n`;
        }
        s += `</${tag}>`;
        item.insertText = new SnippetString(s);
    }

    return item;
}
