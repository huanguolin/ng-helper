import {
    getCursorAtInfo,
    type CursorAtAttrNameInfo,
    type CursorAtAttrValueInfo,
    type CursorAtTagNameInfo,
    type CursorAtTemplateInfo,
} from '@ng-helper/shared/lib/cursorAt';
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
import { buildCursor } from '../../utils';
import { onTypeHover } from '../hover/utils';
import {
    checkServiceAndGetScriptFilePath,
    getControllerNameInfo,
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
                return timeCost('provideDefinition', async () => {
                    const cursorAtInfo = getCursorAtInfo(document.getText(), buildCursor(document, position));

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
                            return handleTagNameOrAttrName(cursorAtInfo, document, port, token);
                        case 'tagName':
                            return handleTagNameOrAttrName(cursorAtInfo, document, port, token);
                        case 'attrValue':
                        case 'template':
                            return handleTemplateOrAttrValue(document, position, cursorAtInfo, port, token);
                    }
                });
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
    token: CancellationToken,
): Promise<Definition | undefined> {
    if (!isHoverValidIdentifierChar(document, position)) {
        return;
    }
    if (isComponentHtml(document)) {
        return handleComponentType(document, cursorAtInfo, port, token);
    }
    const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
    if (ctrlInfo) {
        return handleControllerType(ctrlInfo, document, cursorAtInfo, port, token);
    }
}

async function handleComponentType(
    document: TextDocument,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    const definitionInfo = await onTypeHover({
        document,
        cursorAtInfo,
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
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
    port: number,
    token: CancellationToken,
): Promise<Definition | undefined> {
    const definitionInfo = await onTypeHover({
        document,
        cursorAtInfo,
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
