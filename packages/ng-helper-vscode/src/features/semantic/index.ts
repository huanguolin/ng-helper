import { parseFragment, type Attribute, type DocumentFragment, type Element, type Location } from '@ng-helper/shared/lib/html';
import { camelCase } from 'change-case';
import {
    SemanticTokensLegend,
    type DocumentSemanticTokensProvider,
    type SemanticTokens,
    SemanticTokensBuilder,
    Range,
    languages,
    type ExtensionContext,
    type TextDocument,
} from 'vscode';

import { listComponentsStringAttrs } from '../../service/api';
import { isComponentTagName } from '../utils';

export function registerSemantic(context: ExtensionContext, port: number) {
    const tokenTypes = ['string'];
    const legend = new SemanticTokensLegend(tokenTypes);

    const provider: DocumentSemanticTokensProvider = {
        async provideDocumentSemanticTokens(document, token): Promise<SemanticTokens> {
            const tokensBuilder = new SemanticTokensBuilder(legend);

            const htmlAst = parseFragment(document.getText(), { sourceCodeLocationInfo: true });
            const componentNodes = getComponentNodes(htmlAst);
            const componentNames = componentNodes.map((node) => camelCase(node.tagName));
            if (componentNames.length) {
                const componentsStringAttrs = await listComponentsStringAttrs({
                    port,
                    vscodeCancelToken: token,
                    info: { componentNames, fileName: document.fileName },
                });
                if (componentsStringAttrs) {
                    fillSemanticTokens({ htmlDocument: document, tokensBuilder, componentsStringAttrs, componentNodes });
                }
            }

            return tokensBuilder.build();
        },
    };

    const disposable = languages.registerDocumentSemanticTokensProvider('html', provider, legend);

    context.subscriptions.push(disposable);
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
                    let attrValueStart = getAttrValueStart(attr, attrLocation);
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

    // TODO extract to shared
    function getAttrValueStart(attr: Attribute, location: Location): number | undefined {
        const realAttrText = htmlText.slice(location.startOffset, location.endOffset);
        const guessedAttrText = guessAttrText(attr, '"');
        if (realAttrText.length === guessedAttrText.length) {
            if (guessedAttrText === realAttrText || guessAttrText(attr, "'") === realAttrText) {
                return attr.name.length + '="'.length + '"'.length - 1; // base zero
            } else {
                throw new Error('getAttrValueStart(): Impossible here.');
            }
        } else if (realAttrText.length === attr.name.length) {
            // <span disabled></span>
            return undefined;
        }
        const v = realAttrText.lastIndexOf(attr.value);
        return v >= 0 ? v : undefined;

        function guessAttrText(attr: Attribute, quote: string): string {
            return `${attr.name}=${quote}${attr.value}${quote}`;
        }
    }
}
