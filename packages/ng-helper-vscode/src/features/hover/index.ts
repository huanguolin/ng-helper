import {
    getTextInTemplate,
    Cursor,
    getStartTagText,
    getTheAttrWhileCursorAtValue,
    parseStartTagText,
    indexOfNgFilter,
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

                // 模版 {{}} 中
                const tplText = getTextInTemplate(docText, cursor);
                if (tplText) {
                    const cursorAt = tplText.cursor.at;
                    const contextString = trimFilters(tplText.text, cursorAt);
                    if (contextString) {
                        return getHoverInfo({ document, port, contextString, offset: cursorAt });
                    }
                }

                // 组件属性值中 或者 ng-* 属性值中
                const startTagText = getStartTagText(docText, cursor);
                if (startTagText) {
                    const startTag = parseStartTagText(startTagText.text, startTagText.start);
                    const attr = getTheAttrWhileCursorAtValue(startTag, cursor);
                    if (attr && (isComponentTag(startTag.name.text) || isNgDirectiveAttr(attr.name.text))) {
                        const cursorAt = cursor.at - attr.value!.start;
                        const contextString = trimFilters(attr.value!.text, cursorAt);
                        // TODO ng-class map
                        return getHoverInfo({ document, port, contextString, offset: cursorAt });
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

// 特殊处理:
// 输入：xxx | filter
// 输出：xxx
function trimFilters(contextString: string, cursorAt: number): string {
    const index = indexOfNgFilter(contextString);
    if (index < 0) {
        return contextString;
    }

    if (index <= cursorAt) {
        return '';
    }

    return contextString.slice(0, index);
}
