import {
    isInStartTagAnd,
    getTagAndTheAttrNameWhenInAttrValue,
    getTextInTemplate,
    getTextInDbQuotes,
    TagAndCurrentAttrName,
    Cursor,
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
                const cursor: Cursor = { at: document.offsetAt(position), isHover: true };
                const theChar = docText[cursor.at];
                if (!isValidIdentifier(theChar)) {
                    return;
                }

                const tplText = getTextInTemplate(docText, cursor);
                // TODO filter 处理
                if (tplText) {
                    return getHoverInfo({ document, port, contextString: tplText.str, offset: tplText.cursor.at });
                }

                const textBeforeCursor = docText.slice(0, cursor.at);
                let tagInfo: TagAndCurrentAttrName | undefined = undefined;
                const isInStartTag = isInStartTagAnd(textBeforeCursor, (tagTextBeforeCursor) => {
                    tagInfo = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
                    return Boolean(tagInfo.tagName && tagInfo.attrName);
                });
                if (isInStartTag && tagInfo) {
                    const { tagName, attrName } = tagInfo;
                    if (isComponentTag(tagName) || isNgDirectiveAttr(attrName)) {
                        // TODO filter 处理
                        // TODO ng-class map
                        const attrValueText = getTextInDbQuotes(docText, cursor);
                        if (attrValueText) {
                            return getHoverInfo({ document, port, contextString: attrValueText.str, offset: attrValueText.cursor.at });
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
