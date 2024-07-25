import { Cursor, canCompletionComponentName } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionItem, CompletionList, CancellationToken, SnippetString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getComponentName, getControllerNameFromHtml, getCorrespondingTsFileName } from '../utils';

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

    if (!canCompletionComponentName(docText, cursor)) {
        return;
    }

    const relatedTsFile = (await getCorrespondingTsFileName(document, getControllerNameFromHtml(document))) ?? document.fileName;
    if (!(await checkNgHelperServerRunning(relatedTsFile, port))) {
        return;
    }

    let list = await getComponentNameCompletionApi({ port, info: { fileName: document.fileName }, vscodeCancelToken });
    if (!list || !list.length) {
        return;
    }

    const currentComponentName = getComponentName(document);
    if (currentComponentName) {
        list = list.filter((x) => x.componentName !== camelCase(currentComponentName));
    }

    const preChar = triggerString === '<' ? '' : '<';
    return new CompletionList(
        list.map((x) => {
            const tag = kebabCase(x.componentName);
            const item = new CompletionItem(tag);
            item.insertText = new SnippetString(x.transclude ? `${preChar}${tag}>$0</${tag}>` : `${preChar}${tag} $0/>`);
            item.documentation = x.transclude ? `<${tag}>|</${tag}>` : `<${tag} |/>`;
            item.detail = `[ng-helper]`;
            return item;
        }),
        false,
    );
}
