import {
    isInStartTagAnd,
    isInDbQuote_deprecate,
    getTagAndTheAttrNameWhenInAttrValue,
    getTemplateText,
    getAttrValueText,
} from '@ng-helper/shared/lib/html';
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
                const offset = document.offsetAt(position);
                const theChar = docText[offset];
                if (!isValidIdentifier(theChar)) {
                    return;
                }

                const tplText = getTemplateText(docText, offset);
                // TODO filter 处理
                if (tplText) {
                    return getHoverInfo({ document, port, contextString: tplText.str, offset: offset - tplText.start });
                }

                const textBeforeCursor = docText.slice(0, offset);
                let tagTextBeforeCursor = '';
                if (
                    isInStartTagAnd(textBeforeCursor, (innerTagTextBeforeCursor) => {
                        tagTextBeforeCursor = innerTagTextBeforeCursor;
                        return isInDbQuote_deprecate(innerTagTextBeforeCursor);
                    })
                ) {
                    const { tagName, attrName } = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
                    if (isComponentTag(tagName) || isNgDirectiveAttr(attrName)) {
                        // TODO filter 处理
                        const attrValueText = getAttrValueText(docText, offset);
                        if (attrValueText) {
                            return getHoverInfo({ document, port, contextString: attrValueText.str, offset: offset - attrValueText.start });
                        }
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
