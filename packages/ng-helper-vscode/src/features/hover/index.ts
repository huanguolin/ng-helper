import {
    getCursorAtInfo,
    type CursorAtAttrNameInfo,
    type CursorAtAttrValueInfo,
    type CursorAtTagNameInfo,
    type CursorAtTemplateInfo,
} from '@ng-helper/shared/lib/cursorAt';
import { NgHoverInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import { ExtensionContext, Hover, languages, MarkdownString, TextDocument, Position, CancellationToken } from 'vscode';

import {
    getComponentNameOrAttrNameHoverApi,
    getComponentTypeHoverApi,
    getControllerTypeHoverApi,
    getDirectiveHoverApi,
    getFilterNameHoverApi,
} from '../../service/api';
import { timeoutWithMeasure } from '../../timeout';
import { buildCursor } from '../../utils';
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

import { genBuiltinFilterHoverInfo } from './builtin';
import { onTypeHover } from './utils';

export function registerHover(context: ExtensionContext, port: number): void {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document: TextDocument, position: Position, token: CancellationToken) {
                return await timeoutWithMeasure('provideHover', async () => {
                    const cursorAtInfo = getCursorAtInfo(document.getText(), buildCursor(document, position));

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
                            return await handleTagNameOrAttrName(cursorAtInfo, document, port, token);
                        case 'tagName':
                            return await handleTagNameOrAttrName(cursorAtInfo, document, port, token);
                        case 'attrValue':
                        case 'template':
                            return await handleTemplateOrAttrValue(document, position, port, token, cursorAtInfo);
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
): Promise<Hover | undefined> {
    if (isComponentTagName(cursorAtInfo.tagName) || cursorAtInfo.attrNames.length) {
        const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
        if (!scriptFilePath) {
            return;
        }
        const fn = isComponentTagName(cursorAtInfo.tagName) ? getComponentHover : getDirectiveHover;
        return await fn(scriptFilePath, toNgElementHoverInfo(cursorAtInfo), port, token);
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
    port: number,
    vscodeCancelToken: CancellationToken,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
): Promise<Hover | undefined> {
    if (!isHoverValidIdentifierChar(document, position)) {
        return;
    }

    const info = await onTypeHover({
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
                return await getComponentTypeHoverApi({
                    port,
                    vscodeCancelToken,
                    info: { fileName: scriptFilePath, contextString, cursorAt },
                });
            }

            const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
            if (ctrlInfo) {
                return await getControllerTypeHoverApi({
                    port,
                    vscodeCancelToken: vscodeCancelToken,
                    info: { fileName: scriptFilePath, contextString, cursorAt, ...ctrlInfo },
                });
            }
        },
    });
    return buildHoverResult(info);
}

async function getComponentHover(
    scriptFilePath: string,
    hoverInfo: NgElementHoverInfo,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    hoverInfo.attrNames = []; // component query currently doesn't need all attribute names
    const res = await getComponentNameOrAttrNameHoverApi({
        port,
        vscodeCancelToken: token,
        info: { fileName: scriptFilePath, hoverInfo: hoverInfo },
    });
    return buildHoverResult(res);
}

async function getDirectiveHover(
    scriptFilePath: string,
    hoverInfo: NgElementHoverInfo,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    const cursorAtAttrName = hoverInfo.name;
    const res = await getDirectiveHoverApi({
        port,
        vscodeCancelToken: token,
        info: { fileName: scriptFilePath, attrNames: hoverInfo.attrNames, cursorAtAttrName },
    });
    return buildHoverResult(res);
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
}): Promise<NgHoverInfo | undefined> {
    if (isBuiltinFilter(filterName)) {
        return genBuiltinFilterHoverInfo(filterName);
    } else if (scriptFilePath) {
        return await getFilterNameHoverApi({
            port,
            vscodeCancelToken,
            info: { fileName: scriptFilePath, contextString: filterName, cursorAt: 0 },
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
