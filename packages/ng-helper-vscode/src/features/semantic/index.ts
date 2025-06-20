import {
    getAttrValueStart,
    type Location,
    type Attribute,
    type Element,
    parseHtmlFragmentWithCache,
} from '@ng-helper/shared/lib/html';
import { camelCase, kebabCase } from 'change-case';
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
import { intersect, normalizePath } from '../../utils';
import { getCorrespondingScriptFileName } from '../utils';

import { getComponentNodesAndDirectiveNodes, getComponentsAndDirectivesFromNodes } from './utils';

const tokenTypes = ['string'];

const myLogger = logger.prefixWith('semantic');

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
                    () => htmlSemanticProvider({ document, ngContext, token: tokenSource.token }),
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
    ngContext,
    token,
}: {
    document: TextDocument;
    ngContext: NgContext;
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

    const { componentNames, maybeDirectiveNames } = getComponentsAndDirectivesFromNodes(
        componentNodes,
        maybeDirectiveNodes,
    );
    const stringAttrMaps = await getStringAttrMaps(
        ngContext,
        token,
        componentNames,
        maybeDirectiveNames,
        scriptFilePath,
    );
    if (!stringAttrMaps) {
        return;
    }

    checkCancellation(token);

    const { componentStringAttrMap, directiveStringAttrMap } = stringAttrMaps;
    const hasDirectiveStrAttr = Object.keys(directiveStringAttrMap).length > 0;
    const hasComponentStrAttr = Object.keys(componentStringAttrMap).length > 0;
    if (hasComponentStrAttr || hasDirectiveStrAttr) {
        fillComponentSemanticTokens({
            htmlDocument: document,
            tokensBuilder,
            componentStringAttrMap,
            directiveStringAttrMap,
            componentNodes,
        });
    }
    if (hasDirectiveStrAttr) {
        fillDirectiveSemanticTokens({
            htmlDocument: document,
            tokensBuilder,
            directiveStringAttrMap,
            maybeDirectiveNodes,
        });
    }

    checkCancellation(token);

    return tokensBuilder.build();
}

async function getStringAttrMaps(
    ngContext: NgContext,
    cancelToken: CancellationToken,
    componentNames: string[],
    maybeDirectiveNames: string[],
    filePath: string,
): Promise<
    | {
          componentStringAttrMap: Record<string, string[]>;
          directiveStringAttrMap: Record<string, string[]>;
      }
    | undefined
> {
    let componentStringAttrMap: Record<string, string[]> | undefined;
    if (componentNames.length) {
        try {
            const componentsStringAttrs = await ngContext.rpcApi.listComponentsStringAttrs({
                params: { componentNames, fileName: filePath },
                cancelToken,
            });
            if (componentsStringAttrs) {
                componentStringAttrMap = kebabCaseRecord(componentsStringAttrs);
            }
        } catch (error) {
            myLogger.logError('listComponentsStringAttrs failed', error);
        }
    }

    let directiveStringAttrMap: Record<string, string[]> | undefined;
    if (maybeDirectiveNames.length) {
        try {
            const directivesStringAttrs = await ngContext.rpcApi.listDirectivesStringAttrs({
                params: { maybeDirectiveNames, fileName: filePath },
            });
            if (directivesStringAttrs) {
                directiveStringAttrMap = kebabCaseRecord(directivesStringAttrs);
            }
        } catch (error) {
            myLogger.logError('listDirectivesStringAttrs failed', error);
        }
    }

    if (!componentStringAttrMap && !directiveStringAttrMap) {
        return undefined;
    }

    return {
        componentStringAttrMap: componentStringAttrMap ?? {},
        directiveStringAttrMap: directiveStringAttrMap ?? {},
    };
}

function kebabCaseRecord(record: Record<string, string[]>) {
    return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [kebabCase(key), value.map((x) => kebabCase(x))]),
    );
}

function fillComponentSemanticTokens({
    htmlDocument,
    tokensBuilder,
    componentNodes,
    componentStringAttrMap,
    directiveStringAttrMap,
}: {
    htmlDocument: TextDocument;
    tokensBuilder: SemanticTokensBuilder;
    componentNodes: Element[];
    componentStringAttrMap: Record<string, string[]>;
    directiveStringAttrMap: Record<string, string[]>;
}): void {
    for (const node of componentNodes) {
        const componentStrAttrNames = new Set(componentStringAttrMap[camelCase(node.tagName.toLowerCase())] ?? []);
        const directiveStrAttrNames = new Set<string>();

        if (Object.keys(directiveStringAttrMap).length) {
            for (const attr of node.attrs) {
                const names = directiveStringAttrMap[attr.name.toLowerCase()];
                if (names) {
                    for (const name of names) {
                        directiveStrAttrNames.add(name);
                    }
                }
            }
        }

        if (componentStrAttrNames.size || directiveStrAttrNames.size) {
            const attrsLocation = node.sourceCodeLocation!.attrs!;
            for (const attr of node.attrs) {
                const attrName = attr.name.toLowerCase();
                if (attr.value && componentStrAttrNames.has(attrName)) {
                    fillStringSemanticToken({
                        htmlDocument,
                        tokensBuilder,
                        attrsLocation,
                        attr,
                    });
                } else if (directiveStrAttrNames.has(attrName)) {
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
    directiveStringAttrMap,
    maybeDirectiveNodes,
}: {
    htmlDocument: TextDocument;
    tokensBuilder: SemanticTokensBuilder;
    maybeDirectiveNodes: Element[];
    directiveStringAttrMap: Record<string, string[]>;
}): void {
    const directiveNames = Object.keys(directiveStringAttrMap);
    for (const node of maybeDirectiveNodes) {
        const containsDirectiveNames = intersect(
            node.attrs.map((x) => x.name.toLowerCase()),
            directiveNames,
        );
        const directiveStrAttrSet = new Set(containsDirectiveNames.map((x) => directiveStringAttrMap[x]).flat());

        const attrsLocation = node.sourceCodeLocation?.attrs ?? {};
        for (const attr of node.attrs) {
            const attrName = attr.name.toLowerCase();
            if (directiveStrAttrSet.has(attrName)) {
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
    const attrLocation = attrsLocation[attr.name.toLowerCase()];
    if (!attrLocation) {
        return;
    }

    const attrValueStart = getAttrValueStart(attr, attrLocation, htmlDocument.getText());
    if (typeof attrValueStart !== 'number') {
        return;
    }

    const start = htmlDocument.positionAt(attrValueStart);
    const end = htmlDocument.positionAt(attrValueStart + attr.value.length);
    tokensBuilder.push(new Range(start, end), 'string');
}
