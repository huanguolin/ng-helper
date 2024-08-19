import { Cursor, canCompletionComponentName } from '@ng-helper/shared/lib/html';
import { NgComponentNameInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase, kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionItem, CompletionList, CancellationToken, SnippetString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getComponentName, getControllerNameInfoFromHtml, getCorrespondingTsFileName } from '../utils';

export function componentName(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        {
            async provideCompletionItems(document, position, token, context) {
                return timeCost('provideComponentNameCompletion', async () => {
                    try {
                        return await provideComponentNameCompletion({
                            document,
                            position,
                            triggerString: context.triggerCharacter,
                            port,
                            vscodeCancelToken: token,
                        });
                    } catch (error) {
                        console.error('provideComponentNameCompletion() error:', error);
                        return undefined;
                    }
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

    let list = await getComponentNameCompletionApi({ port, info: { fileName: document.fileName }, vscodeCancelToken });
    if (!list || !list.length) {
        return;
    }

    const currentComponentName = getComponentName(document);
    if (currentComponentName) {
        list = list.filter((x) => x.componentName !== currentComponentName);
    }

    let matchTransclude: NgComponentNameInfo | undefined;
    if (canCompleteInfo.tag) {
        const i = list.findIndex((x) => x.componentName === camelCase(canCompleteInfo.tag!.tagName) && x.transclude);
        if (i >= 0) {
            matchTransclude = list[i];
            list.splice(i, 1);
        }
    }

    const preChar = triggerString === '<' ? '' : '<';
    const items = list.map((x) => buildCompletionItem(x));

    if (matchTransclude && Array.isArray(matchTransclude.transclude) && matchTransclude.transclude.length) {
        let transcludeItems = matchTransclude.transclude;

        // 移除已经存在的兄弟节点
        const sibling = canCompleteInfo.tag!.children;
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
        item.insertText = new SnippetString(x.transclude ? `${preChar}${tag}>$0</${tag}>` : `${preChar}${tag}$0/></${tag}>`);
        item.documentation = x.transclude ? `<${tag}>|</${tag}>` : `<${tag} |></${tag}>`;
        item.detail = '[ng-helper]';
        return item;
    }
}
