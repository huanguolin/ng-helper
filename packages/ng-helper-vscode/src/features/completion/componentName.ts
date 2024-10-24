import { Cursor, SPACE, canCompletionComponentName } from '@ng-helper/shared/lib/html';
import { NgComponentNameInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase, kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionItem, CompletionList, CancellationToken, SnippetString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getComponentName, getControllerNameInfoFromHtml, getCorrespondingTsFileName, isComponentTagName } from '../utils';

export function componentName(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        {
            async provideCompletionItems(document, position, token, context) {
                return timeCost('provideComponentNameCompletion', async () => {
                    // Avoid 'space' key trigger this in inline html.
                    if (context.triggerCharacter && !context.triggerCharacter.trim()) {
                        return;
                    }

                    return await provideComponentNameCompletion({
                        document,
                        position,
                        triggerString: context.triggerCharacter,
                        port,
                        vscodeCancelToken: token,
                    });
                });
            },
        },
        /**
         * 有这个才会触发以 < 开头的补全,
         * 但也会触发没有 < 的补全.
         */
        '<',
    );
}

async function provideComponentNameCompletion({
    document,
    position,
    triggerString,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    position: Position;
    triggerString?: string;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const docText = document.getText();
    const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

    const canCompleteInfo = canCompletionComponentName(docText, cursor);
    if (!canCompleteInfo.canComplete) {
        return;
    }

    const relatedTsFile = (await getCorrespondingTsFileName(document, getControllerNameInfoFromHtml(document)?.controllerName)) ?? document.fileName;
    if (!(await checkNgHelperServerRunning(relatedTsFile, port))) {
        return;
    }

    let list = await getComponentNameCompletionApi({ port, info: { fileName: relatedTsFile }, vscodeCancelToken });
    if (!list || !list.length) {
        return;
    }

    const currentComponentName = getComponentName(document);
    if (currentComponentName) {
        list = list.filter((x) => x.componentName !== currentComponentName);
    }

    let matchTransclude: NgComponentNameInfo | undefined;
    // 光标在一个标签下，尝试找到这个标签的 transclude 信息。
    const currentTag = canCompleteInfo.tag;
    if (currentTag && isComponentTagName(currentTag.tagName)) {
        const i = list.findIndex((x) => x.componentName === camelCase(currentTag.tagName) && x.transclude);
        if (i >= 0) {
            matchTransclude = list[i];
            list.splice(i, 1);
        }
    }

    const preChar = triggerString === '<' ? '' : '<';
    const items = list.map((x) => buildCompletionItem(x));

    if (matchTransclude && matchTransclude.transclude && typeof matchTransclude.transclude !== 'boolean') {
        let transcludeItems = Object.values(matchTransclude.transclude).map((x) => x.replaceAll('?', ''));

        // 移除已经存在的兄弟节点
        const sibling = currentTag!.children;
        if (sibling && sibling.length) {
            transcludeItems = transcludeItems.filter((componentName) => !sibling.some((s) => camelCase(s.tagName) === componentName));
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
        item.detail = '[ng-helper]';
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
