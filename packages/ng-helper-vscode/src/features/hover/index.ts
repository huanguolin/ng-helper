import {
    getCursorAtInfo,
    type CursorAtAttrNameInfo,
    type CursorAtAttrValueInfo,
    type CursorAtTagNameInfo,
    type CursorAtTemplateInfo,
} from '@ng-helper/shared/lib/cursorAt';
import { isComponentTagName, isNgBuiltinDirective } from '@ng-helper/shared/lib/ngUtils';
import { NgHoverInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import { Hover, languages, MarkdownString, TextDocument, Position, CancellationToken } from 'vscode';

import { checkCancellation, createCancellationTokenSource, withTimeoutAndMeasure } from '../../asyncUtils';
import type { NgContext } from '../../ngContext';
import type { RpcApi } from '../../service/tsService/rpcApi';
import { buildCursor } from '../../utils';
import {
    getControllerNameInfo,
    getCorrespondingScriptFileName,
    isBuiltinFilter,
    isComponentHtml,
    isHoverValidIdentifierChar,
    toNgElementHoverInfo,
} from '../utils';

import { genBuiltinFilterHoverInfo } from './builtin';
import { onTypeHover } from './utils';

export function registerHover(ngContext: NgContext): void {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document: TextDocument, position: Position, token: CancellationToken) {
                if (!ngContext.isNgProjectDocument(document)) {
                    return;
                }

                const cancelTokenSource = createCancellationTokenSource(token);
                return await withTimeoutAndMeasure(
                    'provideHover',
                    async () => {
                        const cursorAtInfo = getCursorAtInfo(document.getText(), buildCursor(document, position), {
                            filePath: document.uri.toString(),
                            version: document.version,
                        });

                        checkCancellation(cancelTokenSource.token);
                        switch (cursorAtInfo.type) {
                            case 'endTag':
                            case 'startTag':
                            case 'text':
                                // do nothing
                                return;

                            case 'attrName':
                                if (isNgBuiltinDirective(cursorAtInfo.cursorAtAttrName)) {
                                    return handleBuiltinDirective(cursorAtInfo.cursorAtAttrName);
                                }
                                return await handleTagNameOrAttrName(
                                    cursorAtInfo,
                                    document,
                                    ngContext.rpcApi,
                                    cancelTokenSource.token,
                                );
                            case 'tagName':
                                return await handleTagNameOrAttrName(
                                    cursorAtInfo,
                                    document,
                                    ngContext.rpcApi,
                                    cancelTokenSource.token,
                                );

                            case 'attrValue':
                            case 'template':
                                return await handleTemplateOrAttrValue(
                                    document,
                                    position,
                                    ngContext.rpcApi,
                                    cancelTokenSource.token,
                                    cursorAtInfo,
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
    rpcApi: RpcApi,
    token: CancellationToken,
): Promise<Hover | undefined> {
    if (isComponentTagName(cursorAtInfo.tagName) || cursorAtInfo.attrNames.length) {
        const scriptFilePath = await getCorrespondingScriptFileName(document);
        if (!scriptFilePath) {
            return;
        }

        checkCancellation(token);

        const fn = isComponentTagName(cursorAtInfo.tagName) ? getComponentHover : getDirectiveHover;
        return await fn(scriptFilePath, toNgElementHoverInfo(cursorAtInfo), rpcApi, token);
    }
    return undefined;
}

function handleBuiltinDirective(cursorAtAttrName: string): Hover | undefined {
    const ngAttrName = camelCase(cursorAtAttrName);
    return buildHoverResult({
        formattedTypeString: `(directive) ${ngAttrName}`,
        document: `Angular.js built-in directive, see [document](https://docs.angularjs.org/api/ng/directive/${ngAttrName}).`,
    });
}

async function handleTemplateOrAttrValue(
    document: TextDocument,
    position: Position,
    rpcApi: RpcApi,
    cancelToken: CancellationToken,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
): Promise<Hover | undefined> {
    if (!isHoverValidIdentifierChar(document, position)) {
        return;
    }

    checkCancellation(cancelToken);

    const info = await onTypeHover({
        type: 'hover',
        document,
        cursorAtInfo,
        onHoverFilterName: async (filterName, scriptFilePath) => {
            checkCancellation(cancelToken);
            return await handleFilterName({
                rpcApi,
                cancelToken: cancelToken,
                filterName,
                scriptFilePath,
            });
        },
        onHoverType: async (scriptFilePath, contextString, cursorAt, hoverPropName) => {
            checkCancellation(cancelToken);

            if (isComponentHtml(document)) {
                return await rpcApi.getComponentTypeHoverApi({
                    cancelToken,
                    params: { fileName: scriptFilePath, contextString, cursorAt, hoverPropName },
                });
            }

            const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
            if (ctrlInfo) {
                return await rpcApi.getControllerTypeHoverApi({
                    cancelToken,
                    params: { fileName: scriptFilePath, contextString, cursorAt, hoverPropName, ...ctrlInfo },
                });
            }
        },
        onHoverLocalType: ({ value, typeString }) => ({
            formattedTypeString: `(property) ${value}: ${typeString}`,
            document: '',
        }),
    });
    return buildHoverResult(info);
}

async function getComponentHover(
    scriptFilePath: string,
    hoverInfo: NgElementHoverInfo,
    tsServer: RpcApi,
    cancelToken: CancellationToken,
): Promise<Hover | undefined> {
    checkCancellation(cancelToken);

    hoverInfo.attrNames = []; // component query currently doesn't need all attribute names
    const res = await tsServer.getComponentNameOrAttrNameHoverApi({
        cancelToken,
        params: { fileName: scriptFilePath, hoverInfo: hoverInfo },
    });
    return buildHoverResult(res);
}

async function getDirectiveHover(
    scriptFilePath: string,
    hoverInfo: NgElementHoverInfo,
    rpcApi: RpcApi,
    cancelToken: CancellationToken,
): Promise<Hover | undefined> {
    checkCancellation(cancelToken);

    const cursorAtAttrName = hoverInfo.name;
    const res = await rpcApi.getDirectiveHoverApi({
        cancelToken,
        params: { fileName: scriptFilePath, attrNames: hoverInfo.attrNames, cursorAtAttrName },
    });
    return buildHoverResult(res);
}

async function handleFilterName({
    filterName,
    scriptFilePath,
    rpcApi,
    cancelToken,
}: {
    filterName: string;
    scriptFilePath?: string;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
}): Promise<NgHoverInfo | undefined> {
    checkCancellation(cancelToken);

    if (isBuiltinFilter(filterName)) {
        return genBuiltinFilterHoverInfo(filterName);
    } else if (scriptFilePath) {
        return await rpcApi.getFilterNameHoverApi({
            cancelToken,
            params: { fileName: scriptFilePath, contextString: filterName, cursorAt: 0 },
        });
    }
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
