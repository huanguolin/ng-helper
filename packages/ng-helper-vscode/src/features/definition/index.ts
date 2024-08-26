import type { NgDefinitionInfo } from '@ng-helper/shared/lib/plugin';
import { Location, Range, Uri, languages, workspace, type Definition, type ExtensionContext } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameOrAttrNameDefinitionApi, getComponentTypeDefinitionApi, getControllerTypeDefinitionApi } from '../../service/api';
import { provideTypeHoverInfo } from '../hover/utils';
import { checkServiceAndGetTsFilePath, getControllerNameInfoFromHtml, getHoveredTagNameOrAttr, isComponentHtml, isComponentTagName } from '../utils';

export function registerDefinition(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerDefinitionProvider('html', {
            async provideDefinition(document, position, token) {
                const hoverInfo = getHoveredTagNameOrAttr(document, document.offsetAt(position));
                if (hoverInfo) {
                    return timeCost('provideComponentNameOrAttrNameDefinition', async () => {
                        try {
                            if (hoverInfo.type === 'attrName' && hoverInfo.name.startsWith('ng')) {
                                return;
                            }

                            if (!isComponentTagName(hoverInfo.tagName)) {
                                return;
                            }

                            const tsFilePath = await checkServiceAndGetTsFilePath(document, port);
                            const definitionInfo = await getComponentNameOrAttrNameDefinitionApi({
                                port,
                                vscodeCancelToken: token,
                                info: { fileName: tsFilePath!, hoverInfo: hoverInfo },
                            });
                            return await buildDefinition(definitionInfo);
                        } catch (error) {
                            console.error('provideComponentNameOrAttrNameDefinition() error:', error);
                        }
                    });
                }

                if (isComponentHtml(document)) {
                    return timeCost('provideComponentTypeDefinition', async () => {
                        try {
                            const definitionInfo = await provideTypeHoverInfo({
                                document,
                                position,
                                port,
                                api: (tsFilePath, contextString, cursorAt) =>
                                    getComponentTypeDefinitionApi({
                                        port,
                                        vscodeCancelToken: token,
                                        info: { fileName: tsFilePath, contextString, cursorAt },
                                    }),
                            });
                            return await buildDefinition(definitionInfo);
                        } catch (error) {
                            console.error('provideComponentTypeDefinition() error:', error);
                            return undefined;
                        }
                    });
                }

                const ctrlInfo = getControllerNameInfoFromHtml(document);
                if (ctrlInfo && ctrlInfo.controllerAs) {
                    return timeCost('provideControllerTypeDefinition`', async () => {
                        try {
                            const definitionInfo = await provideTypeHoverInfo({
                                document,
                                position,
                                port,
                                api: (tsFilePath, contextString, cursorAt) =>
                                    getControllerTypeDefinitionApi({
                                        port,
                                        vscodeCancelToken: token,
                                        info: { fileName: tsFilePath, contextString, cursorAt, ...ctrlInfo },
                                    }),
                            });
                            return await buildDefinition(definitionInfo);
                        } catch (error) {
                            console.error('provideControllerTypeDefinition`() error:', error);
                            return undefined;
                        }
                    });
                }
            },
        }),
    );
}

async function buildDefinition(definitionInfo: NgDefinitionInfo | undefined): Promise<Definition | undefined> {
    if (!definitionInfo) {
        return;
    }

    const uri = Uri.file(definitionInfo.filePath);
    const document = await workspace.openTextDocument(uri);
    const start = document.positionAt(definitionInfo.start);
    const end = document.positionAt(definitionInfo.end);
    return new Location(uri, new Range(start, end));
}
