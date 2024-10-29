import type { NgCtrlInfo, NgDefinitionInfo, NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
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
import { provideTypeHoverInfo } from '../hover/utils';
import {
    checkServiceAndGetScriptFilePath,
    getControllerNameInfoFromHtml,
    getHoveredTagNameOrAttr,
    isComponentHtml,
    isComponentTagName,
} from '../utils';

export function registerDefinition(context: ExtensionContext, port: number): void {
    context.subscriptions.push(
        languages.registerDefinitionProvider('html', {
            async provideDefinition(
                document: TextDocument,
                position: Position,
                token: CancellationToken,
            ): Promise<Definition | undefined> {
                const tagOrAttrHoverInfo = getHoveredTagNameOrAttr(document, document.offsetAt(position));
                if (tagOrAttrHoverInfo) {
                    return handleTagOrAttr(tagOrAttrHoverInfo, document, port, token);
                }

                if (isComponentHtml(document)) {
                    return handleComponentType(document, position, port, token);
                }

                const ctrlInfo = getControllerNameInfoFromHtml(document);
                if (ctrlInfo) {
                    return handleControllerType(ctrlInfo, document, position, port, token);
                }
            },
        }),
    );
}

async function handleTagOrAttr(
    hoverInfo: NgElementHoverInfo,
    document: TextDocument,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    return timeCost('provideComponentNameOrAttrNameDefinition', async () => {
        if (hoverInfo.type === 'attrName' && hoverInfo.name.startsWith('ng')) {
            return;
        }

        if (isComponentTagName(hoverInfo.tagName) || (hoverInfo.type === 'attrName' && hoverInfo.attrNames.length)) {
            const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
            if (!scriptFilePath) {
                return;
            }

            if (isComponentTagName(hoverInfo.tagName)) {
                const definitionInfo = await getComponentNameOrAttrNameDefinitionApi({
                    port,
                    vscodeCancelToken: token,
                    info: { fileName: scriptFilePath, hoverInfo: hoverInfo },
                });
                return await buildDefinition(definitionInfo);
            } else {
                const cursorAtAttrName = hoverInfo.name;
                const definitionInfo = await getDirectiveDefinitionApi({
                    port,
                    vscodeCancelToken: token,
                    info: { fileName: scriptFilePath, attrNames: hoverInfo.attrNames, cursorAtAttrName },
                });
                return await buildDefinition(definitionInfo);
            }
        }
    });
}

async function handleComponentType(
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    return timeCost('provideComponentTypeDefinition', async () => {
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
    });
}

async function handleControllerType(
    ctrlInfo: NgCtrlInfo,
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    return timeCost('provideControllerTypeDefinition', async () => {
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
    });
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
