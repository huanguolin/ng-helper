import {
    getAttrValueStart,
    type Location,
    type Attribute,
    type Element,
    parseHtmlFragmentWithCache,
} from '@ng-helper/shared/lib/html';
import { isNgUserCustomAttr } from '@ng-helper/shared/lib/ngUtils';
import { camelCase } from 'change-case';
import {
    SemanticTokensLegend,
    type SemanticTokens,
    SemanticTokensBuilder,
    Range,
    languages,
    type TextDocument,
    type CancellationToken,
} from 'vscode';

import { checkCancellation, createCancellationTokenSource, withTimeoutAndMeasure } from '../../asyncUtils';
import { logger } from '../../logger';
import type { NgContext } from '../../ngContext';
import type { RpcApi } from '../../service/tsService/rpcApi';
import { intersect, normalizePath, uniq } from '../../utils';
import { getCorrespondingScriptFileName } from '../utils';

import { getComponentNodesAndDirectiveNodes } from './utils';

const tokenTypes = ['string'];
export const legend = new SemanticTokensLegend(tokenTypes);

export function registerSemantic(ngContext: NgContext) {
    const disposable = languages.registerDocumentSemanticTokensProvider(
        'html',
        {
            async provideDocumentSemanticTokens(document, token): Promise<SemanticTokens | undefined> {
                if (!ngContext.isNgProjectDocument(document)) {
                    return;
                }

                const tokenSource = createCancellationTokenSource(token);
                return await withTimeoutAndMeasure(
                    'provideSemantic',
                    () => htmlSemanticProvider({ document, rpcApi: ngContext.rpcApi, token: tokenSource.token }),
                    {
                        cancelTokenSource: tokenSource,
                        silent: true,
                    },
                );
            },
        },
        legend,
    );

    ngContext.vscodeContext.subscriptions.push(disposable);
}

export async function htmlSemanticProvider({
    document,
    rpcApi,
    token,
}: {
    document: TextDocument;
    rpcApi: RpcApi;
    token: CancellationToken;
}) {
    const tokensBuilder = new SemanticTokensBuilder(legend);

    const htmlAst = parseHtmlFragmentWithCache(document.getText(), {
        filePath: normalizePath(document.uri.fsPath), // 注意：这里的处理方式要一致，否则缓存会失效
        version: document.version,
    });
    const { componentNodes, maybeDirectiveNodes } = getComponentNodesAndDirectiveNodes(htmlAst);
    if (!componentNodes.length && !maybeDirectiveNodes.length) {
        return;
    }

    checkCancellation(token);

    const scriptFilePath = await getCorrespondingScriptFileName(document);
    if (!scriptFilePath) {
        logger.logWarning('htmlSemanticProvider() "scriptFilePath" not found!');
        return;
    }

    checkCancellation(token);

    const componentNames = uniq(componentNodes.map((x) => camelCase(x.tagName.toLowerCase())));
    const maybeDirectiveNames = uniq(
        maybeDirectiveNodes
            .map((x) => x.attrs.filter((y) => isNgUserCustomAttr(y.name)).map((y) => camelCase(y.name.toLowerCase())))
            .flat(),
    );
    const promiseArr: Promise<void>[] = [];
    if (componentNames.length) {
        promiseArr.push(
            (async () => {
                const componentsStringAttrs = await rpcApi.listComponentsStringAttrs({
                    cancelToken: token,
                    params: { componentNames, fileName: scriptFilePath },
                });
                if (componentsStringAttrs) {
                    fillComponentSemanticTokens({
                        htmlDocument: document,
                        tokensBuilder,
                        componentsStringAttrs,
                        componentNodes,
                    });
                }
            })(),
        );
    }
    if (maybeDirectiveNames.length) {
        promiseArr.push(
            (async () => {
                const directivesStringAttrs = await rpcApi.listDirectivesStringAttrs({
                    cancelToken: token,
                    params: { maybeDirectiveNames, fileName: scriptFilePath },
                });
                if (directivesStringAttrs) {
                    fillDirectiveSemanticTokens({
                        htmlDocument: document,
                        tokensBuilder,
                        directivesStringAttrs,
                        maybeDirectiveNodes,
                    });
                }
            })(),
        );
    }

    await Promise.all(promiseArr);

    checkCancellation(token);

    return tokensBuilder.build();
}

function fillComponentSemanticTokens({
    htmlDocument,
    tokensBuilder,
    componentsStringAttrs,
    componentNodes,
}: {
    htmlDocument: TextDocument;
    tokensBuilder: SemanticTokensBuilder;
    componentsStringAttrs: Record<string, string[]>;
    componentNodes: Element[];
}): void {
    for (const node of componentNodes) {
        const attrNames = componentsStringAttrs[camelCase(node.tagName)];
        if (attrNames) {
            const attrsLocation = node.sourceCodeLocation!.attrs!;
            for (const attr of node.attrs) {
                if (attr.value && attrNames.includes(camelCase(attr.name))) {
                    fillStringSemanticToken({
                        htmlDocument,
                        tokensBuilder,
                        attrsLocation,
                        attr,
                    });
                }
            }
        }
    }
}

function fillDirectiveSemanticTokens({
    htmlDocument,
    tokensBuilder,
    directivesStringAttrs,
    maybeDirectiveNodes,
}: {
    htmlDocument: TextDocument;
    tokensBuilder: SemanticTokensBuilder;
    directivesStringAttrs: Record<string, string[]>;
    maybeDirectiveNodes: Element[];
}): void {
    const directiveNames = Object.keys(directivesStringAttrs);
    for (const node of maybeDirectiveNodes) {
        const containsDirectiveNames = intersect(
            node.attrs.map((x) => camelCase(x.name)),
            directiveNames,
        );
        const directiveStrAttrSet = new Set(containsDirectiveNames.map((x) => directivesStringAttrs[x]).flat());

        const attrsLocation = node.sourceCodeLocation!.attrs!;
        for (const attr of node.attrs) {
            if (directiveStrAttrSet.has(camelCase(attr.name))) {
                fillStringSemanticToken({
                    htmlDocument,
                    tokensBuilder,
                    attrsLocation,
                    attr,
                });
            }
        }
    }
}

function fillStringSemanticToken({
    htmlDocument,
    tokensBuilder,
    attrsLocation,
    attr,
}: {
    htmlDocument: TextDocument;
    tokensBuilder: SemanticTokensBuilder;
    attrsLocation: Record<string, Location>;
    attr: Attribute;
}): void {
    const attrLocation = attrsLocation[attr.name];
    const attrValueStart = getAttrValueStart(attr, attrLocation, htmlDocument.getText());
    if (typeof attrValueStart === 'undefined') {
        return;
    }

    const start = htmlDocument.positionAt(attrValueStart);
    const end = htmlDocument.positionAt(attrValueStart + attr.value.length);
    tokensBuilder.push(new Range(start, end), 'string');
}
