import { canCompletionHtmlAttr, Cursor, getHtmlTagAt } from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
import { languages, TextDocument, Position, CompletionItem, CompletionList, SnippetString, type CancellationToken, CompletionItemKind } from 'vscode';

import { timeCost } from '../../debug';
import { getDirectiveCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getCorrespondingTsFileName, getControllerNameInfoFromHtml, isComponentTagName } from '../utils';

export function customDirective(port: number) {
    return languages.registerCompletionItemProvider('html', {
        async provideCompletionItems(document, position, token, context) {
            return timeCost('provideCustomDirectiveCompletion', async () => {
                try {
                    // 要 undefined 时才能触发自动补全
                    if (context.triggerCharacter) {
                        return;
                    }
                    return await provideCustomDirectiveCompletion({ document, position, port, vscodeCancelToken: token });
                } catch (error) {
                    console.error('provideCustomDirectiveCompletion() error:', error);
                    return undefined;
                }
            });
        },
    });
}

async function provideCustomDirectiveCompletion({
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

    const attrNames = tag.attrs.sort((a, b) => a.name.start - b.name.start).map((a) => camelCase(a.name.text));
    const list = await getDirectiveCompletionApi({
        port,
        info: { fileName: relatedTsFile, attrNames },
        vscodeCancelToken,
    });
    if (!list || !list.length) {
        return;
    }

    return new CompletionList(
        list.map((x, i) => {
            const directiveName = kebabCase(x.name);
            const item = new CompletionItem(directiveName, x.kind === 'directiveAttr' ? CompletionItemKind.Field : CompletionItemKind.Property);
            // TODO 等号什么时候需要？另外要区分是指令的属性还是指令本身
            item.insertText = new SnippetString(`${directiveName}="$1"$0`);
            item.documentation = [x.kind, x.typeString && `type: ${x.typeString}`, x.document].filter(Boolean).join('\n');
            item.detail = '[ng-helper]';
            item.sortText = i.toString().padStart(2, '0');
            return item;
        }),
        false,
    );
}
