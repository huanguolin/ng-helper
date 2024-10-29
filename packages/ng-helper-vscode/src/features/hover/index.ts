import { NgHoverInfo, type NgCtrlInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { ExtensionContext, Hover, languages, MarkdownString, TextDocument, Position, CancellationToken } from 'vscode';

import { timeCost } from '../../debug';
import {
    getComponentNameOrAttrNameHoverApi,
    getComponentTypeHoverApi,
    getControllerTypeHoverApi,
    getDirectiveHoverApi,
} from '../../service/api';
import {
    checkServiceAndGetScriptFilePath,
    getControllerNameInfoFromHtml,
    getHoveredTagNameOrAttr,
    isComponentHtml,
    isComponentTagName,
} from '../utils';

import { provideTypeHoverInfo } from './utils';

export function registerHover(context: ExtensionContext, port: number): void {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document: TextDocument, position: Position, token: CancellationToken) {
                const tagOrAttrHoverInfo = getHoveredTagNameOrAttr(document, document.offsetAt(position));
                if (tagOrAttrHoverInfo) {
                    return handleTagOrAttr(tagOrAttrHoverInfo, document, port, token);
                }

                if (isComponentHtml(document)) {
                    return handleComponentType(document, position, port, token);
                }

                const ctrlInfo = getControllerNameInfoFromHtml(document);
                if (ctrlInfo && ctrlInfo.controllerAs) {
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
): Promise<Hover | undefined> {
    return timeCost('provideComponentNameOrAttrNameHover', async () => {
        if (hoverInfo.type === 'attrName' && hoverInfo.name.startsWith('ng')) {
            return buildHoverResult({
                formattedTypeString: `(directive) ${hoverInfo.name}`,
                document: `Angular.js built-in directive, see [document](https://docs.angularjs.org/api/ng/directive/${hoverInfo.name}).`,
            });
        }

        if (isComponentTagName(hoverInfo.tagName) || (hoverInfo.type === 'attrName' && hoverInfo.attrNames.length)) {
            const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
            if (!scriptFilePath) {
                return;
            }

            if (isComponentTagName(hoverInfo.tagName)) {
                return await getComponentHover(scriptFilePath, hoverInfo, port, token);
            } else {
                return await getDirectiveHover(scriptFilePath, hoverInfo, port, token);
            }
        }
    });
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

async function handleComponentType(
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    return timeCost('provideComponentTypeHover', async () => {
        const info = await provideTypeHoverInfo({
            document,
            position,
            port,
            api: (scriptFilePath, contextString, cursorAt) =>
                getComponentTypeHoverApi({
                    port,
                    vscodeCancelToken: token,
                    info: { fileName: scriptFilePath, contextString, cursorAt },
                }),
        });
        return buildHoverResult(info);
    });
}

async function handleControllerType(
    ctrlInfo: NgCtrlInfo,
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    return timeCost('provideControllerTypeHover', async () => {
        const info = await provideTypeHoverInfo({
            document,
            position,
            port,
            api: (scriptFilePath, contextString, cursorAt) =>
                getControllerTypeHoverApi({
                    port,
                    vscodeCancelToken: token,
                    info: { fileName: scriptFilePath, contextString, cursorAt, ...ctrlInfo },
                }),
        });
        return buildHoverResult(info);
    });
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
