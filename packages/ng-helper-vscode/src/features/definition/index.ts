import type { NgDefinitionInfo } from '@ng-helper/shared/lib/plugin';
import { Location, Position, Range, Uri, languages, workspace, type Definition, type ExtensionContext } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameOrAttrNameDefinitionApi, getComponentTypeDefinitionApi, getControllerTypeDefinitionApi } from '../../service/api';
import { isFileExistsOnWorkspace } from '../../utils';
import { provideTypeHoverInfo } from '../hover/utils';
import { checkServiceAndGetTsFilePath, getControllerNameInfoFromHtml, getHoveredTagNameOrAttr, isComponentHtml, isComponentTagName } from '../utils';

export function registerDefinition(context: ExtensionContext, port: number) {
    registerGotoTs(context, port);
    registerGotoHtml(context);
}

function registerGotoHtml(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerDefinitionProvider(
            [
                { scheme: 'file', language: 'javascript' },
                { scheme: 'file', language: 'typescript' },
            ],
            {
                async provideDefinition(document, position) {
                    // TODO: 字符串开头引号要和结尾匹配，还要考虑转义的问题
                    const range = document.getWordRangeAtPosition(position, /templateUrl\s*:\s*['"][^'"]+['"]/);
                    if (!range) {
                        return;
                    }

                    const text = document.getText(range);
                    // TODO: 字符串开头引号要和结尾匹配，还要考虑转义的问题
                    const filePath = text.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);

                    if (!filePath || filePath.length < 2) {
                        return;
                    }

                    const relativePath = filePath[1];
                    const targetPath = resolveHtmlPath(relativePath);

                    if (await isFileExistsOnWorkspace(Uri.file(targetPath))) {
                        return new Location(Uri.file(targetPath), new Position(0, 0));
                    }
                },
            },
        ),
    );
}

function resolveHtmlPath(templateUrl: string): string {
    // TODO: resolve
    return templateUrl;
}

function registerGotoTs(context: ExtensionContext, port: number) {
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
