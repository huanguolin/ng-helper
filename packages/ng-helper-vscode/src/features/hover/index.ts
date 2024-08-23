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
import { getComponentNameOrAttrNameHoverApi, getComponentTypeHoverApi, getControllerTypeHoverApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import {
    getControllerNameInfoFromHtml,
    getCorrespondingTsFileName,
    getHoveredComponentNameOrAttr,
    isComponentHtml,
    isComponentTagName,
    isNgDirectiveAttr,
    isValidIdentifier,
} from '../utils';

export function registerHover(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document, position, vscodeCancelToken) {
                const componentHoverInfo = getHoveredComponentNameOrAttr(document, document.offsetAt(position));
                if (componentHoverInfo) {
                    return timeCost('provideComponentNameOrAttrNameHover', async () => {
                        try {
                            if (componentHoverInfo.type === 'attrName' && componentHoverInfo.name.startsWith('ng')) {
                                // TODO ng-* 处理
                                return;
                            }
                            return await getHoverInfo({
                                document,
                                port,
                                getHoverApi: (tsFilePath) =>
                                    getComponentNameOrAttrNameHoverApi({
                                        port,
                                        vscodeCancelToken,
                                        info: { fileName: tsFilePath, hoverInfo: componentHoverInfo },
                                    }),
                            });
                        } catch (error) {
                            console.error('provideComponentNameOrAttrNameHover() error:', error);
                            return undefined;
                        }
                    });
                }

                if (isComponentHtml(document)) {
                    return timeCost('provideComponentTypeHover', async () => {
                        try {
                            return await provideTypeHover({
                                document,
                                position,
                                port,
                                getHoverApi: (tsFilePath, contextString, cursorAt) =>
                                    getComponentTypeHoverApi({ port, vscodeCancelToken, info: { fileName: tsFilePath, contextString, cursorAt } }),
                            });
                        } catch (error) {
                            console.error('provideComponentTypeHover() error:', error);
                            return undefined;
                        }
                    });
                }

                const ctrlInfo = getControllerNameInfoFromHtml(document);
                if (ctrlInfo && ctrlInfo.controllerAs) {
                    return timeCost('provideControllerTypeHover', async () => {
                        try {
                            return await provideTypeHover({
                                document,
                                position,
                                port,
                                getHoverApi: (tsFilePath, contextString, cursorAt) =>
                                    getControllerTypeHoverApi({
                                        port,
                                        vscodeCancelToken,
                                        info: { fileName: tsFilePath, contextString, cursorAt, ...ctrlInfo },
                                    }),
                            });
                        } catch (error) {
                            console.error('provideControllerTypeHover() error:', error);
                            return undefined;
                        }
                    });
                }
            },
        }),
    );
}

async function provideTypeHover({
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
