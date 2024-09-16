import { NgHoverInfo } from '@ng-helper/shared/lib/plugin';
import { ExtensionContext, Hover, languages, MarkdownString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameOrAttrNameHoverApi, getComponentTypeHoverApi, getControllerTypeHoverApi, getDirectiveHoverApi } from '../../service/api';
import { checkServiceAndGetTsFilePath, getControllerNameInfoFromHtml, getHoveredTagNameOrAttr, isComponentHtml, isComponentTagName } from '../utils';

import { provideTypeHoverInfo } from './utils';

export function registerHover(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document, position, vscodeCancelToken) {
                const hoverInfo = getHoveredTagNameOrAttr(document, document.offsetAt(position));
                if (hoverInfo) {
                    return timeCost('provideComponentNameOrAttrNameHover', async () => {
                        try {
                            if (hoverInfo.type === 'attrName' && hoverInfo.name.startsWith('ng')) {
                                return buildHoverResult({
                                    formattedTypeString: `(directive) ${hoverInfo.name}`,
                                    document: `Angular.js built-in directive, see [document](https://docs.angularjs.org/api/ng/directive/${hoverInfo.name}).`,
                                });
                            }

                            if (isComponentTagName(hoverInfo.tagName) || (hoverInfo.type === 'attrName' && hoverInfo.attrNames.length)) {
                                const tsFilePath = await checkServiceAndGetTsFilePath(document, port);
                                if (!tsFilePath) {
                                    return;
                                }

                                if (isComponentTagName(hoverInfo.tagName)) {
                                    hoverInfo.attrNames = []; // component 查询目前不需要所有属性名字
                                    const res = await getComponentNameOrAttrNameHoverApi({
                                        port,
                                        vscodeCancelToken,
                                        info: { fileName: tsFilePath, hoverInfo: hoverInfo },
                                    });
                                    return buildHoverResult(res);
                                } else {
                                    const cursorAtAttrName = hoverInfo.name;
                                    const res = await getDirectiveHoverApi({
                                        port,
                                        vscodeCancelToken,
                                        info: { fileName: tsFilePath, attrNames: hoverInfo.attrNames, cursorAtAttrName },
                                    });
                                    return buildHoverResult(res);
                                }
                            }
                        } catch (error) {
                            console.error('provideComponentNameOrAttrNameHover() error:', error);
                            return undefined;
                        }
                    });
                }

                if (isComponentHtml(document)) {
                    return timeCost('provideComponentTypeHover', async () => {
                        try {
                            const info = await provideTypeHoverInfo({
                                document,
                                position,
                                port,
                                api: (tsFilePath, contextString, cursorAt) =>
                                    getComponentTypeHoverApi({ port, vscodeCancelToken, info: { fileName: tsFilePath, contextString, cursorAt } }),
                            });
                            return buildHoverResult(info);
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
                            const info = await provideTypeHoverInfo({
                                document,
                                position,
                                port,
                                api: (tsFilePath, contextString, cursorAt) =>
                                    getControllerTypeHoverApi({
                                        port,
                                        vscodeCancelToken,
                                        info: { fileName: tsFilePath, contextString, cursorAt, ...ctrlInfo },
                                    }),
                            });
                            return buildHoverResult(info);
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

function buildHoverResult(res: NgHoverInfo | undefined): Hover | undefined {
    if (!res) {
        return;
    }
    const markdownStr = new MarkdownString();
    markdownStr.appendCodeblock(res.formattedTypeString, 'typescript');
    if (res.document) {
        markdownStr.appendMarkdown(res.document);
    }
    return new Hover(markdownStr);
}
