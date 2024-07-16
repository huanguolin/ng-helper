import {
    getTextInTemplate,
    Cursor,
    getTheAttrWhileCursorAtValue,
    indexOfNgFilter,
    getMapValues,
    getHtmlTagByCursor,
    HtmlAttr,
} from '@ng-helper/shared/lib/html';
import { CancellationToken, ExtensionContext, Hover, languages, MarkdownString, Position, TextDocument } from 'vscode';

import { getComponentHover } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr, isValidIdentifier } from '../utils';

export function registerComponentHover(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document, position, token) {
                try {
                    return await provideHover({ document, position, port, vscodeCancelToken: token });
                } catch (error) {
                    console.error('provideHover() error:', error);
                    return undefined;
                }
            },
        }),
    );
}

async function provideHover({
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
            return await getHoverInfo({ document, port, contextString, cursorAt, vscodeCancelToken });
        }
    }

    // 组件属性值中 或者 ng-* 属性值中
    const tag = getHtmlTagByCursor(docText, cursor);
    if (tag) {
        const attr = getTheAttrWhileCursorAtValue(tag, cursor);
        if (attr && attr.value && (isComponentTag(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
            let cursorAt = cursor.at - attr.value.start;
            let contextString = trimFilters(attr.value.text, cursorAt);
            // handle ng-class/ng-style map value
            ({ contextString, cursorAt } = handleMapAttrValue(attr, contextString, cursorAt));
            return await getHoverInfo({ document, port, contextString, cursorAt, vscodeCancelToken });
        }
    }
}

async function getHoverInfo({
    document,
    port,
    contextString,
    cursorAt,
    vscodeCancelToken,
}: {
    document: TextDocument;
    port: number;
    contextString: string;
    cursorAt: number;
    vscodeCancelToken: CancellationToken;
}): Promise<Hover | undefined> {
    // remove .html add .ts
    const tsFilePath = document.fileName.slice(0, -5) + '.ts';

    await ensureTsServerRunning(tsFilePath, port);

    const res = await getComponentHover({ port, info: { fileName: tsFilePath, contextString, cursorAt }, vscodeCancelToken });

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

function handleMapAttrValue(attr: HtmlAttr, contextString: string, cursorAt: number) {
    if (attr.name.text === 'ng-class' || attr.name.text === 'ng-style') {
        const mapValues = getMapValues(contextString);
        if (mapValues && mapValues.length) {
            const hoveredValue = mapValues.find((v) => v.start <= cursorAt && cursorAt <= v.start + v.text.length);
            if (hoveredValue) {
                contextString = hoveredValue.text;
                cursorAt = cursorAt - hoveredValue.start;
            }
        }
    }
    return { contextString, cursorAt };
}
