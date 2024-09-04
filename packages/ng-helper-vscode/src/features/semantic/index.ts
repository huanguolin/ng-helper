import { getAttrValueStart, parseFragment, type DocumentFragment, type Element } from '@ng-helper/shared/lib/html';
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

import { listComponentsStringAttrs } from '../../service/api';
import { uniq } from '../../utils';
import { checkServiceAndGetTsFilePath, isComponentTagName } from '../utils';

const tokenTypes = ['string'];
export const legend = new SemanticTokensLegend(tokenTypes);

export function registerSemantic(context: ExtensionContext, port: number) {
    const disposable = languages.registerDocumentSemanticTokensProvider(
        'html',
        {
            async provideDocumentSemanticTokens(document, token): Promise<SemanticTokens> {
                return await htmlSemanticProvider(document, port, token);
            },
        },
        legend,
    );

    context.subscriptions.push(disposable);
}

export async function htmlSemanticProvider(document: TextDocument, port: number, token: CancellationToken) {
    const tokensBuilder = new SemanticTokensBuilder(legend);

    const htmlAst = parseFragment(document.getText(), { sourceCodeLocationInfo: true });
    const componentNodes = getComponentNodes(htmlAst);
    const componentNames = uniq(componentNodes.map((node) => camelCase(node.tagName)));
    if (componentNames.length) {
        const tsFilePath = await checkServiceAndGetTsFilePath(document, port);
        if (tsFilePath) {
            const componentsStringAttrs = await listComponentsStringAttrs({
                port,
                vscodeCancelToken: token,
                info: { componentNames, fileName: tsFilePath },
            });
            if (componentsStringAttrs) {
                fillSemanticTokens({ htmlDocument: document, tokensBuilder, componentsStringAttrs, componentNodes });
            }
        }
    }

    return tokensBuilder.build();
}

function getComponentNodes(htmlAst: DocumentFragment): Element[] {
    const componentNodes: Element[] = [];
    iter(htmlAst.childNodes);
    return componentNodes;

    function iter(nodes: DocumentFragment['childNodes']) {
        for (const node of nodes) {
            const e = node as Element;
            if (e.attrs?.length && isComponentTagName(e.tagName)) {
                componentNodes.push(e);
            }
            if (e.childNodes?.length) {
                iter(e.childNodes);
            }
        }
    }
}

function fillSemanticTokens({
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
    const htmlText = htmlDocument.getText();

    for (const node of componentNodes) {
        const attrNames = componentsStringAttrs[camelCase(node.tagName)];
        if (attrNames) {
            const attrsLocation = node.sourceCodeLocation!.attrs!;
            for (const attr of node.attrs) {
                if (attr.value && attrNames.includes(camelCase(attr.name))) {
                    const attrLocation = attrsLocation[attr.name];
                    let attrValueStart = getAttrValueStart(attr, attrLocation, htmlText);
                    if (typeof attrValueStart === 'undefined') {
                        continue;
                    }

                    attrValueStart += attrLocation.startOffset;
                    const start = htmlDocument.positionAt(attrValueStart);
                    const end = htmlDocument.positionAt(attrValueStart + attr.value.length);
                    tokensBuilder.push(new Range(start, end), 'string');
                }
            }
        }
    }
}
