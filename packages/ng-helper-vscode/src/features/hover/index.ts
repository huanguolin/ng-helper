import {
    getTextInTemplate,
    Cursor,
    getTheAttrWhileCursorAtValue,
    indexOfNgFilter,
    getMapValues,
    getHtmlTagByCursor,
    HtmlAttr,
} from '@ng-helper/shared/lib/html';
import { NgHoverInfo } from '@ng-helper/shared/lib/plugin';
import { ExtensionContext, Hover, languages, MarkdownString, Position, TextDocument } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentHoverApi, getControllerHoverApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import {
    getControllerNameInfoFromHtml,
    getCorrespondingTsFileName,
    isComponentHtml,
    isComponentTagName,
    isNgDirectiveAttr,
    isValidIdentifier,
} from '../utils';

export function registerComponentHover(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document, position, vscodeCancelToken) {
                if (isComponentHtml(document)) {
                    return timeCost('provideComponentHover', async () => {
                        try {
                            return await provideHover({
                                document,
                                position,
                                port,
                                getHoverApi: (tsFilePath, contextString, cursorAt) =>
                                    getComponentHoverApi({ port, vscodeCancelToken, info: { fileName: tsFilePath, contextString, cursorAt } }),
                            });
                        } catch (error) {
                            console.error('provideComponentHover() error:', error);
                            return undefined;
                        }
                    });
                }

                const ctrlInfo = getControllerNameInfoFromHtml(document);
                if (ctrlInfo && ctrlInfo.controllerAs) {
                    return timeCost('provideControllerHover', async () => {
                        try {
                            return await provideHover({
                                document,
                                position,
                                port,
                                getHoverApi: (tsFilePath, contextString, cursorAt) =>
                                    getControllerHoverApi({
                                        port,
                                        vscodeCancelToken,
                                        info: { fileName: tsFilePath, contextString, cursorAt, ...ctrlInfo },
                                    }),
                            });
                        } catch (error) {
                            console.error('provideControllerHover() error:', error);
                            return undefined;
                        }
                    });
                }
            },
        }),
    );
}

async function provideHover({
    document,
    position,
    port,
    getHoverApi,
}: {
    document: TextDocument;
    position: Position;
    port: number;
    getHoverApi: (tsFilePath: string, contextString: string, cursorAt: number) => Promise<NgHoverInfo | undefined>;
}) {
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
            return await getHoverInfo({
                document,
                port,
                getHoverApi: (tsFilePath) => getHoverApi(tsFilePath, contextString, cursorAt),
            });
        }
    }

    // 组件属性值中 或者 ng-* 属性值中
    const tag = getHtmlTagByCursor(docText, cursor);
    if (tag) {
        const attr = getTheAttrWhileCursorAtValue(tag, cursor);
        if (attr && attr.value && (isComponentTagName(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
            let cursorAt = cursor.at - attr.value.start;
            let contextString = trimFilters(attr.value.text, cursorAt);
            // handle ng-class/ng-style map value
            ({ contextString, cursorAt } = handleMapAttrValue(attr, contextString, cursorAt));
            return await getHoverInfo({
                document,
                port,
                getHoverApi: (tsFilePath) => getHoverApi(tsFilePath, contextString, cursorAt),
            });
        }
    }
}

async function getHoverInfo({
    document,
    port,
    getHoverApi,
}: {
    document: TextDocument;
    port: number;
    getHoverApi: (tsFilePath: string) => Promise<NgHoverInfo | undefined>;
}): Promise<Hover | undefined> {
    const tsFilePath = (await getCorrespondingTsFileName(document))!;

    if (!(await checkNgHelperServerRunning(tsFilePath, port))) {
        return;
    }

    const res = await getHoverApi(tsFilePath);

    return buildHoverResult(res);
}

function buildHoverResult(res: NgHoverInfo | undefined): Hover | undefined {
    if (!res) {
        return;
    }
    const markdownStr = new MarkdownString();
    markdownStr.appendCodeblock(res.formattedTypeString, 'typescript');
    if (res.document) {
        markdownStr.appendText(res.document);
    }
    return new Hover(markdownStr);
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
