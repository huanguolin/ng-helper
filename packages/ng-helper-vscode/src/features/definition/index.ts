import {
    getCursorAtInfo,
    type CursorAtAttrNameInfo,
    type CursorAtAttrValueInfo,
    type CursorAtTagNameInfo,
    type CursorAtTemplateInfo,
} from '@ng-helper/shared/lib/cursorAt';
import type { NgDefinitionInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import {
    Location,
    Range,
    Uri,
    languages,
    workspace,
    type Definition,
    type ExtensionContext,
    TextDocument,
    Position,
    CancellationToken,
} from 'vscode';

import { checkCancellation, createCancellationTokenSource, withTimeoutAndMeasure } from '../../asyncUtils';
import {
    getComponentNameOrAttrNameDefinitionApi,
    getComponentTypeDefinitionApi,
    getControllerTypeDefinitionApi,
    getDirectiveDefinitionApi,
    getFilterNameDefinitionApi,
} from '../../service/api';
import { buildCursor } from '../../utils';
import { onTypeHover } from '../hover/utils';
import {
    checkServiceAndGetScriptFilePath,
    getControllerNameInfo,
    isBuiltinFilter,
    isComponentHtml,
    isComponentTagName,
    isHoverValidIdentifierChar,
    isNgBuiltinDirective,
    toNgElementHoverInfo,
} from '../utils';

export function registerDefinition(context: ExtensionContext, port: number): void {
    context.subscriptions.push(
        languages.registerDefinitionProvider('html', {
            async provideDefinition(
                document: TextDocument,
                position: Position,
                token: CancellationToken,
            ): Promise<Definition | undefined> {
                const cancelTokenSource = createCancellationTokenSource(token);
                return await withTimeoutAndMeasure(
                    'provideDefinition',
                    async () => {
                        const cursorAtInfo = getCursorAtInfo(document.getText(), buildCursor(document, position));

                        checkCancellation(cancelTokenSource.token);

                        switch (cursorAtInfo.type) {
                            case 'endTag':
                            case 'startTag':
                            case 'text':
                                // do nothing
                                return;

                            case 'attrName':
                                if (isNgBuiltinDirective(cursorAtInfo.cursorAtAttrName)) {
                                    return;
                                }
                                return await handleTagNameOrAttrName(
                                    cursorAtInfo,
                                    document,
                                    port,
                                    cancelTokenSource.token,
                                );
                            case 'tagName':
                                return await handleTagNameOrAttrName(
                                    cursorAtInfo,
                                    document,
                                    port,
                                    cancelTokenSource.token,
                                );

                            case 'attrValue':
                            case 'template':
                                return await handleTemplateOrAttrValue(
                                    document,
                                    position,
                                    cursorAtInfo,
                                    port,
                                    cancelTokenSource.token,
                                );
                        }
                    },
                    { cancelTokenSource },
                );
            },
        }),
    );
}

async function handleTagNameOrAttrName(
    cursorAtInfo: CursorAtTagNameInfo | CursorAtAttrNameInfo,
    document: TextDocument,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    if (isComponentTagName(cursorAtInfo.tagName) || cursorAtInfo.attrNames.length) {
        const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
        if (!scriptFilePath) {
            return;
        }

        if (isComponentTagName(cursorAtInfo.tagName)) {
            const definitionInfo = await getComponentNameOrAttrNameDefinitionApi({
                port,
                vscodeCancelToken: token,
                info: { fileName: scriptFilePath, hoverInfo: toNgElementHoverInfo(cursorAtInfo) },
            });
            return await buildDefinition(definitionInfo);
        } else if (cursorAtInfo.type === 'attrName') {
            const cursorAtAttrName = camelCase(cursorAtInfo.cursorAtAttrName);
            const definitionInfo = await getDirectiveDefinitionApi({
                port,
                vscodeCancelToken: token,
                info: {
                    fileName: scriptFilePath,
                    attrNames: cursorAtInfo.attrNames.map((x) => camelCase(x)),
                    cursorAtAttrName,
                },
            });
            return await buildDefinition(definitionInfo);
        }
    }
}

async function handleTemplateOrAttrValue(
    document: TextDocument,
    position: Position,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
    port: number,
    vscodeCancelToken: CancellationToken,
): Promise<Definition | undefined> {
    if (!isHoverValidIdentifierChar(document, position)) {
        return;
    }

    const definitionInfo = await onTypeHover({
        document,
        cursorAtInfo,
        port,
        onHoverFilterName: (filterName, scriptFilePath) =>
            handleFilterName({
                port,
                vscodeCancelToken,
                filterName,
                scriptFilePath,
            }),
        onHoverType: async (scriptFilePath, contextString, cursorAt) => {
            if (isComponentHtml(document)) {
                return await getComponentTypeDefinitionApi({
                    port,
                    vscodeCancelToken,
                    info: { fileName: scriptFilePath, contextString, cursorAt },
                });
            }
            const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
            if (ctrlInfo) {
                return await getControllerTypeDefinitionApi({
                    port,
                    vscodeCancelToken: vscodeCancelToken,
                    info: { fileName: scriptFilePath, contextString, cursorAt, ...ctrlInfo },
                });
            }
        },
    });
    return await buildDefinition(definitionInfo);
}

async function handleFilterName({
    filterName,
    scriptFilePath,
    port,
    vscodeCancelToken,
}: {
    filterName: string;
    scriptFilePath?: string;
    port: number;
    vscodeCancelToken: CancellationToken;
}): Promise<NgDefinitionInfo | undefined> {
    if (isBuiltinFilter(filterName)) {
        return;
    } else if (scriptFilePath) {
        return await getFilterNameDefinitionApi({
            port,
            vscodeCancelToken,
            info: { fileName: scriptFilePath, filterName },
        });
    }
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
