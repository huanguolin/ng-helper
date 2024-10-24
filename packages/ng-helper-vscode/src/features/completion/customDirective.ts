import { canCompletionHtmlAttr, Cursor, getHtmlTagAt, SPACE } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import {
    languages,
    TextDocument,
    Position,
    CompletionItem,
    CompletionList,
    SnippetString,
    type CancellationToken,
    CompletionItemKind,
    type CompletionItemProvider,
} from 'vscode';

import { timeCost } from '../../debug';
import { getDirectiveCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getCorrespondingTsFileName, getControllerNameInfoFromHtml, isComponentTagName } from '../utils';

export function customDirective(port: number) {
    // 这里拆成两个是为了兼容 html 和 inline html. (componentName 和 componentAttr 也有这样的处理)
    return [
        languages.registerCompletionItemProvider('html', buildProvider('directive')),
        languages.registerCompletionItemProvider('html', buildProvider('directiveAttr'), ' '),
    ];

    function buildProvider(queryType: 'directive' | 'directiveAttr'): CompletionItemProvider {
        const provider: CompletionItemProvider<CompletionItem> = {
            async provideCompletionItems(document, position, token, context) {
                return timeCost('provideCustomDirectiveCompletion', async () => {
                    if (
                        (queryType === 'directive' && typeof context.triggerCharacter === 'undefined') ||
                        (queryType === 'directiveAttr' && context.triggerCharacter === SPACE)
                    ) {
                        return await provideCustomDirectiveCompletion({
                            document,
                            position,
                            queryType,
                            port,
                            vscodeCancelToken: token,
                        });
                    }
                });
            },
        };
        return provider;
    }
}

async function provideCustomDirectiveCompletion({
    document,
    position,
    port,
    vscodeCancelToken,
    queryType,
}: {
    document: TextDocument;
    position: Position;
    port: number;
    vscodeCancelToken: CancellationToken;
    queryType: 'directive' | 'directiveAttr';
}) {
    const docText = document.getText();
    const cursor: Cursor = { at: document.offsetAt(position), isHover: false };
    const tag = getHtmlTagAt(docText, cursor);
    if (!tag || isComponentTagName(tag.tagName) || (typeof tag.startTagEnd === 'number' && cursor.at >= tag.startTagEnd)) {
        return;
    }

    const tagTextBeforeCursor = docText.slice(tag.start, cursor.at);
    if (!canCompletionHtmlAttr(tagTextBeforeCursor)) {
        return;
    }

    const relatedTsFile = (await getCorrespondingTsFileName(document, getControllerNameInfoFromHtml(document)?.controllerName)) ?? document.fileName;
    if (!(await checkNgHelperServerRunning(relatedTsFile, port))) {
        return;
    }

    const attrs = tag.attrs.sort((a, b) => a.name.start - b.name.start);
    const attrNames = attrs.map((a) => camelCase(a.name.text));
    const afterCursorAttrName = camelCase(attrs.find((a) => a.name.start > cursor.at)?.name.text ?? '');

    const list = await getDirectiveCompletionApi({
        port,
        info: { fileName: relatedTsFile, attrNames, queryType, afterCursorAttrName },
        vscodeCancelToken,
    });
    if (!list || !list.length) {
        return;
    }

    const isDirectiveAttr = queryType === 'directiveAttr';
    return new CompletionList(
        list.map((x, i) => {
            const directiveName = kebabCase(x.name);
            const item = new CompletionItem(directiveName, isDirectiveAttr ? CompletionItemKind.Field : CompletionItemKind.Property);
            item.insertText = new SnippetString(isDirectiveAttr ? `${directiveName}="$1"$0` : `${directiveName}$0`);
            item.documentation = [isDirectiveAttr ? '(attribute of directive)' : '(directive)', x.typeString && `type: ${x.typeString}`, x.document]
                .filter(Boolean)
                .join('\n');
            item.detail = '[ng-helper]';
            item.sortText = i.toString().padStart(2, '0');
            return item;
        }),
        false,
    );
}
