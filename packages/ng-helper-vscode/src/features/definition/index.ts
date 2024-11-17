import { getCursorAtInfo } from '@ng-helper/shared/lib/cursorAt';
import type { NgCtrlInfo, NgDefinitionInfo } from '@ng-helper/shared/lib/plugin';
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

import { timeCost } from '../../debug';
import {
    getComponentNameOrAttrNameDefinitionApi,
    getComponentTypeDefinitionApi,
    getControllerNameDefinitionApi,
    getControllerTypeDefinitionApi,
    getDirectiveDefinitionApi,
} from '../../service/api';
import { cursor } from '../../utils';
import { provideTypeHoverInfo } from '../hover/utils';
import {
    checkServiceAndGetScriptFilePath,
    getControllerNameInfo,
    isComponentHtml,
    isComponentTagName,
    isHoverValidIdentifierChar,
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
                return timeCost('provideDefinition', async () => {
                    const cursorAtInfo = getCursorAtInfo(document.getText(), cursor(document, position));
                    if (
                        !cursorAtInfo ||
                        cursorAtInfo.type === 'startTag' ||
                        (cursorAtInfo.type === 'attrName' && cursorAtInfo.cursorAtAttrName.startsWith('ng'))
                    ) {
                        return;
                    }

                    if (cursorAtInfo.type === 'tagName' || cursorAtInfo.type === 'attrName') {
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
                    } else if (cursorAtInfo.type === 'attrValue' || cursorAtInfo.type === 'template') {
                        if (!isHoverValidIdentifierChar(document, position)) {
                            return;
                        }
                        if (isComponentHtml(document)) {
                            return handleComponentType(document, position, port, token);
                        }
                        const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
                        if (ctrlInfo) {
                            return handleControllerType(ctrlInfo, document, position, port, token);
                        }
                    }
                });
            },
        }),
    );
}

async function handleComponentType(
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    const definitionInfo = await provideTypeHoverInfo({
        document,
        position,
        port,
        api: (scriptFilePath, contextString, cursorAt) =>
            getComponentTypeDefinitionApi({
                port,
                vscodeCancelToken: token,
                info: { fileName: scriptFilePath, contextString, cursorAt },
            }),
    });
    return await buildDefinition(definitionInfo);
}

async function handleControllerType(
    ctrlInfo: NgCtrlInfo,
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    const definitionInfo = await provideTypeHoverInfo({
        document,
        position,
        port,
        api: (scriptFilePath, contextString, cursorAt) =>
            ctrlInfo.controllerAs
                ? getControllerTypeDefinitionApi({
                      port,
                      vscodeCancelToken: token,
                      info: { fileName: scriptFilePath, contextString, cursorAt, ...ctrlInfo },
                  })
                : getControllerNameDefinitionApi({
                      port,
                      vscodeCancelToken: token,
                      info: { fileName: scriptFilePath, controllerName: ctrlInfo.controllerName },
                  }),
    });
    return await buildDefinition(definitionInfo);
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
