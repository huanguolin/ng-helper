import {
    getAttrValueStart,
    parseFragment,
    type Location,
    type Attribute,
    type DocumentFragment,
    type Element,
} from '@ng-helper/shared/lib/html';
import { camelCase } from 'change-case';
import {
    SemanticTokensLegend,
    type SemanticTokens,
    SemanticTokensBuilder,
    Range,
    languages,
    type ExtensionContext,
    type TextDocument,
    type CancellationToken,
} from 'vscode';

import { checkCancellation, createCancellationTokenSource, withTimeoutAndMeasure } from '../../asyncUtils';
import type { TsService } from '../../service/tsService';
import { intersect, uniq } from '../../utils';
import { getCorrespondingScriptFileName, isComponentTagName, isNgUserCustomAttr } from '../utils';

const tokenTypes = ['string'];
export const legend = new SemanticTokensLegend(tokenTypes);

export function registerSemantic(context: ExtensionContext, tsService: TsService) {
    const disposable = languages.registerDocumentSemanticTokensProvider(
        'html',
        {
            provideDocumentSemanticTokens(document, token): Promise<SemanticTokens | undefined> {
                const tokenSource = createCancellationTokenSource(token);
                return withTimeoutAndMeasure(
                    'provideSemantic',
                    () => htmlSemanticProvider({ document, tsService, token: tokenSource.token }),
                    {
                        cancelTokenSource: tokenSource,
                        silent: true,
                    },
                );
            },
        },
        legend,
    );

    context.subscriptions.push(disposable);
}

export async function htmlSemanticProvider({
    document,
    tsService,
    token,
}: {
    document: TextDocument;
    tsService: TsService;
    token: CancellationToken;
}) {
    const tokensBuilder = new SemanticTokensBuilder(legend);

    const htmlAst = parseFragment(document.getText(), { sourceCodeLocationInfo: true });
    const { componentNodes, maybeDirectiveNodes } = getComponentNodesAndDirectiveNodes(htmlAst);
    if (!componentNodes.length && !maybeDirectiveNodes.length) {
        return;
    }

    checkCancellation(token);

    const scriptFilePath = await getCorrespondingScriptFileName(document);
    if (!scriptFilePath) {
        console.warn('scriptFilePath not found!');
        return;
    }

    checkCancellation(token);

    const componentNames = uniq(componentNodes.map((x) => camelCase(x.tagName)));
    const maybeDirectiveNames = uniq(
        maybeDirectiveNodes
            .map((x) => x.attrs.filter((y) => isNgUserCustomAttr(y.name)).map((y) => camelCase(y.name)))
            .flat(),
    );
    const promiseArr: Promise<void>[] = [];
    if (componentNames.length) {
        promiseArr.push(
            (async () => {
                const componentsStringAttrs = await tsService.listComponentsStringAttrs({
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
                const directivesStringAttrs = await tsService.listDirectivesStringAttrs({
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

function getComponentNodesAndDirectiveNodes(htmlAst: DocumentFragment): {
    componentNodes: Element[];
    maybeDirectiveNodes: Element[];
} {
    const componentNodes: Element[] = [];
    const maybeDirectiveNodes: Element[] = [];
    iter(htmlAst.childNodes);
    return { componentNodes, maybeDirectiveNodes };

    function iter(nodes: DocumentFragment['childNodes']) {
        for (const node of nodes) {
            const e = node as Element;
            if (e.attrs?.length) {
                if (isComponentTagName(e.tagName)) {
                    componentNodes.push(e);
                } else {
                    const maybeDirectiveNames = e.attrs.filter((x) => isNgUserCustomAttr(x.name)).map((x) => x.name);
                    if (maybeDirectiveNames.length) {
                        maybeDirectiveNodes.push(e);
                    }
                }
            }

            if (e.childNodes?.length) {
                iter(e.childNodes);
            }
        }
    }
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
