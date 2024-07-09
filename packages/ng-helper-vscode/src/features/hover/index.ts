import { isInTemplate, isInStartTagAnd, isInDbQuote, getTagAndTheAttrNameWhenInAttrValue, getTemplateInnerTextAll } from '@ng-helper/shared/lib/html';
import { ExtensionContext, Hover, languages, MarkdownString, TextDocument } from 'vscode';

import { getComponentHover } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr, isValidIdentifier } from '../utils';

export function registerComponentHover(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            provideHover(document, position, _token) {
                if (!isComponentHtml(document)) {
                    return undefined;
                }

                const docText = document.getText();
                let offset = document.offsetAt(position);
                const theChar = docText[offset];
                if (!isValidIdentifier(theChar)) {
                    return;
                }

                const textBeforeCursor = docText.slice(0, offset);
                const textAfterCursor = docText.slice(offset);
                if (isInTemplate(textBeforeCursor)) {
                    const templateStartIndex = textBeforeCursor.lastIndexOf('{{');
                    offset -= templateStartIndex + '{{'.length;
                    const contextString = getTemplateInnerTextAll(textBeforeCursor, textAfterCursor);
                    // TODO 处理 filter
                    if (contextString) {
                        return getHoverInfo({ document, port, contextString, offset });
                    }
                }

                let tagTextBeforeCursor = '';
                if (
                    isInStartTagAnd(textBeforeCursor, (innerTagTextBeforeCursor) => {
                        tagTextBeforeCursor = innerTagTextBeforeCursor;
                        return isInDbQuote(innerTagTextBeforeCursor);
                    })
                ) {
                    const { tagName, attrName } = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
                    if (isComponentTag(tagName) || isNgDirectiveAttr(attrName)) {
                        // TODO
                        // const prefix = getAttrValueText(tagTextBeforeCursor);
                        // if (prefix) {
                        //     return getHoverInfo({ document, port, prefix });
                        // }
                    }
                }
            },
        }),
    );
}

async function getHoverInfo({
    document,
    port,
    contextString,
    offset,
}: {
    document: TextDocument;
    port: number;
    contextString: string;
    offset: number;
}): Promise<Hover | undefined> {
    // remove .html add .ts
    const tsFilePath = document.fileName.slice(0, -5) + '.ts';

    await ensureTsServerRunning(tsFilePath, port);

    const res = await getComponentHover(port, { fileName: tsFilePath, contextString, offset });

    if (res) {
        const markdownStr = new MarkdownString();
        markdownStr.appendCodeblock(res.formattedTypeString, 'typescript');
        if (res.document) {
            markdownStr.appendText(res.document);
        }
        return new Hover(markdownStr);
    }
}
