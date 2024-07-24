import { Cursor, canCompletionComponentName } from '@ng-helper/shared/lib/html';
import { kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionItem, CompletionList, CancellationToken, SnippetString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';

export function componentName(port: number) {
    return languages.registerCompletionItemProvider('html', {
        async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken) {
            return timeCost('provideComponentNameCompletion', async () => {
                try {
                    return await provideComponentNameCompletion({ document, position, port, vscodeCancelToken: token });
                } catch (error) {
                    console.error('provideComponentNameCompletion() error:', error);
                    return undefined;
                }
            });
        },
    });
}

async function provideComponentNameCompletion({
    document,
    position,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    position: Position;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const docText = document.getText();
    const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

    if (canCompletionComponentName(docText, cursor)) {
        return await getComponentNameCompletion(document, port, vscodeCancelToken);
    }
}

async function getComponentNameCompletion(document: TextDocument, port: number, vscodeCancelToken: CancellationToken) {
    if (!(await checkNgHelperServerRunning(document.fileName, port))) {
        return;
    }

    const list = await getComponentNameCompletionApi({ port, info: { fileName: document.fileName }, vscodeCancelToken });
    if (list && list.length > 0) {
        return new CompletionList(
            list.map((x) => {
                const tagName = kebabCase(x);
                const item = new CompletionItem(tagName);
                item.insertText = new SnippetString(`<${tagName} $0 />`);
                item.detail = `[ng-helper]`;
                item.documentation = `<${tagName} | />`;
                return item;
            }),
            false,
        );
    }
}
