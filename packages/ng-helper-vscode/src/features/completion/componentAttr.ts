import { Cursor, canCompletionHtmlAttr, getHtmlTagAt } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionList, CancellationToken, CompletionItem, SnippetString, CompletionItemKind } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentAttrCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getControllerNameInfoFromHtml, getCorrespondingScriptFileName, isComponentTagName } from '../utils';

export function componentAttr(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        {
            async provideCompletionItems(document, position, token) {
                return timeCost('provideComponentAttrCompletion', async () => {
                    return await provideComponentAttrCompletion({
                        document,
                        position,
                        port,
                        vscodeCancelToken: token,
                    });
                });
            },
        },
        ' ',
    );
}

async function provideComponentAttrCompletion({
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
    const tag = getHtmlTagAt(docText, cursor);
    if (!tag || !isComponentTagName(tag.tagName) || (typeof tag.startTagEnd === 'number' && cursor.at >= tag.startTagEnd)) {
        return;
    }

    const tagTextBeforeCursor = docText.slice(tag.start, cursor.at);
    if (!canCompletionHtmlAttr(tagTextBeforeCursor)) {
        return;
    }

    const relatedScriptFile =
        (await getCorrespondingScriptFileName(document, getControllerNameInfoFromHtml(document)?.controllerName)) ?? document.fileName;
    if (!(await checkNgHelperServerRunning(relatedScriptFile, port))) {
        return;
    }

    let list = await getComponentAttrCompletionApi({
        port,
        info: { fileName: relatedScriptFile, componentName: camelCase(tag.tagName) },
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
            return !tag.attrs.some((attr) => attr.name.text === x.name);
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
        list.map((x, i) => {
            const item = new CompletionItem(x.name, CompletionItemKind.Field);
            item.insertText = new SnippetString(`${x.name}="$1"$0`);
            item.documentation = `type: ${x.typeString}\n` + x.document;
            item.detail = '[ng-helper]';
            item.sortText = i.toString().padStart(2, '0');
            return item;
        }),
        false,
    );
}
