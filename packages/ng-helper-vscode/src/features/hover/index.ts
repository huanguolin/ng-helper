import { NgHoverInfo } from '@ng-helper/shared/lib/plugin';
import { ExtensionContext, Hover, languages, MarkdownString } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameOrAttrNameHoverApi, getComponentTypeHoverApi, getControllerTypeHoverApi } from '../../service/api';
import { checkServiceAndGetTsFilePath, getControllerNameInfoFromHtml, getHoveredComponentNameOrAttr, isComponentHtml } from '../utils';

import { provideTypeHoverInfo } from './utils';

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

                            const tsFilePath = await checkServiceAndGetTsFilePath(document, port);
                            if (!tsFilePath) {
                                return;
                            }

                            const res = await getComponentNameOrAttrNameHoverApi({
                                port,
                                vscodeCancelToken,
                                info: { fileName: tsFilePath, hoverInfo: componentHoverInfo },
                            });
                            return buildHoverResult(res);
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
        markdownStr.appendText(res.document);
    }
    return new Hover(markdownStr);
}
