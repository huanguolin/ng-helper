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
import type { TsService } from '../../service/tsService';
import { buildCursor } from '../../utils';
import { onTypeHover } from '../hover/utils';
import {
    getControllerNameInfo,
    getCorrespondingScriptFileName,
    isBuiltinFilter,
    isComponentHtml,
    isComponentTagName,
    isHoverValidIdentifierChar,
    isNgBuiltinDirective,
    toNgElementHoverInfo,
} from '../utils';

export function registerDefinition(context: ExtensionContext, tsService: TsService): void {
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
                                    tsService,
                                    cancelTokenSource.token,
                                );
                            case 'tagName':
                                return await handleTagNameOrAttrName(
                                    cursorAtInfo,
                                    document,
                                    tsService,
                                    cancelTokenSource.token,
                                );

                            case 'attrValue':
                            case 'template':
                                return await handleTemplateOrAttrValue(
                                    document,
                                    position,
                                    cursorAtInfo,
                                    tsService,
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
    tsService: TsService,
    cancelToken: CancellationToken,
): Promise<Definition | undefined> {
    if (isComponentTagName(cursorAtInfo.tagName) || cursorAtInfo.attrNames.length) {
        const scriptFilePath = await getCorrespondingScriptFileName(document);
        if (!scriptFilePath) {
            return;
        }

        if (isComponentTagName(cursorAtInfo.tagName)) {
            const definitionInfo = await tsService.getComponentNameOrAttrNameDefinitionApi({
                cancelToken,
                params: { fileName: scriptFilePath, hoverInfo: toNgElementHoverInfo(cursorAtInfo) },
            });
            return await buildDefinition(definitionInfo);
        } else if (cursorAtInfo.type === 'attrName') {
            const cursorAtAttrName = camelCase(cursorAtInfo.cursorAtAttrName);
            const definitionInfo = await tsService.getDirectiveDefinitionApi({
                cancelToken,
                params: {
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
    tsService: TsService,
    cancelToken: CancellationToken,
): Promise<Definition | undefined> {
    if (!isHoverValidIdentifierChar(document, position)) {
        return;
    }

    const definitionInfo = await onTypeHover({
        type: 'definition',
        document,
        cursorAtInfo,
        onHoverFilterName: (filterName, scriptFilePath) =>
            handleFilterName({
                tsService,
                cancelToken: cancelToken,
                filterName,
                scriptFilePath,
            }),
        onHoverType: async (scriptFilePath, contextString, cursorAt) => {
            if (isComponentHtml(document)) {
                return await tsService.getComponentTypeDefinitionApi({
                    cancelToken,
                    params: { fileName: scriptFilePath, contextString, cursorAt },
                });
            }
            const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
            if (ctrlInfo) {
                return await tsService.getControllerTypeDefinitionApi({
                    cancelToken,
                    params: { fileName: scriptFilePath, contextString, cursorAt, ...ctrlInfo },
                });
            }
        },
        onHoverLocalType: ({ location }) => ({
            filePath: document.fileName,
            ...location!,
        }),
    });
    return await buildDefinition(definitionInfo);
}

async function handleFilterName({
    filterName,
    scriptFilePath,
    tsService,
    cancelToken,
}: {
    filterName: string;
    scriptFilePath?: string;
    tsService: TsService;
    cancelToken: CancellationToken;
}): Promise<NgDefinitionInfo | undefined> {
    if (isBuiltinFilter(filterName)) {
        return;
    } else if (scriptFilePath) {
        return await tsService.getFilterNameDefinitionApi({
            cancelToken,
            params: { fileName: scriptFilePath, filterName },
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
