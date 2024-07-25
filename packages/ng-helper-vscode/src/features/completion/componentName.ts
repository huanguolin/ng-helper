import { Cursor, canCompletionComponentName } from '@ng-helper/shared/lib/html';
import { kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionItem, CompletionList, CancellationToken, SnippetString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getComponentName, getCorrespondingTsFileName } from '../utils';

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

    if (!(await checkNgHelperServerRunning(getCorrespondingTsFileName(document), port))) {
        return;
    }

    let list = await getComponentNameCompletionApi({ port, info: { fileName: document.fileName }, vscodeCancelToken });
    if (!list || !list.length) {
        return;
    }

    list = list.map((x) => kebabCase(x));

    const currentComponentName = getComponentName(document);
    if (currentComponentName) {
        list = list.filter((x) => x !== currentComponentName);
    }

    const preChar = triggerString === '<' ? '' : '<';
    return new CompletionList(
        list.map((tag) => {
            const item = new CompletionItem(tag);
            item.insertText = new SnippetString(`${preChar}${tag} $0 />`);
            item.detail = `[ng-helper]`;
            item.documentation = `<${tag} | />`;
            return item;
        }),
        false,
    );
}
