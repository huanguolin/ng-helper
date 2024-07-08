import { isInTemplate, isInStartTagAnd, isInDbQuote, getTagAndTheAttrNameWhenInAttrValue, getTemplateInnerTextAll } from '@ng-helper/shared/lib/html';
import { ExtensionContext, Hover, languages, Position, Range, TextDocument } from 'vscode';

import { getComponentHover } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr } from '../utils';

export function registerComponentHover(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            provideHover(document, position, _token) {
                if (!isComponentHtml(document)) {
                    return undefined;
                }

                const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
                const textAfterCursor = document.getText(new Range(position, document.positionAt(document.getText().length)));
                if (isInTemplate(textBeforeCursor)) {
                    const contextString = getTemplateInnerTextAll(textBeforeCursor, textAfterCursor);
                    // TODO 处理 filter
                    if (contextString) {
                        return getHoverInfo({ document, port, contextString });
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
    contextString,
    port,
}: {
    document: TextDocument;
    contextString: string;
    port: number;
}): Promise<Hover | undefined> {
    // remove .html add .ts
    const tsFilePath = document.fileName.slice(0, -5) + '.ts';

    await ensureTsServerRunning(tsFilePath, port);

    const res = await getComponentHover(port, { fileName: tsFilePath, contextString });

    if (res) {
        // TODO complete hover info
        return new Hover(res.typeString);
    }
}
