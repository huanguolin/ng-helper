import type { DocumentFragment, Element } from '@ng-helper/shared/lib/html';
import { isComponentTagName, isNgUserCustomAttr } from '@ng-helper/shared/lib/ngUtils';
import { camelCase } from 'change-case';

import { uniq } from '../../utils';

export function getComponentNodesAndDirectiveNodes(htmlAst: DocumentFragment): {
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

export function getComponentsAndDirectives(htmlAst: DocumentFragment): {
    componentNames: string[];
    maybeDirectiveNames: string[];
} {
    const { componentNodes, maybeDirectiveNodes } = getComponentNodesAndDirectiveNodes(htmlAst);

    return getComponentsAndDirectivesFromNodes(componentNodes, maybeDirectiveNodes);
}

export function getComponentsAndDirectivesFromNodes(
    componentNodes: Element[],
    maybeDirectiveNodes: Element[],
): {
    componentNames: string[];
    maybeDirectiveNames: string[];
} {
    const components: string[] = [];
    const maybeDirectives: string[] = [];

    for (const node of componentNodes) {
        components.push(node.tagName);
        for (const attr of node.attrs) {
            if (isNgUserCustomAttr(attr.name)) {
                maybeDirectives.push(attr.name);
            }
        }
    }

    for (const node of maybeDirectiveNodes) {
        for (const attr of node.attrs) {
            if (isNgUserCustomAttr(attr.name)) {
                maybeDirectives.push(attr.name);
            }
        }
    }

    return {
        componentNames: uniq(components).map((x) => camelCase(x.toLowerCase())),
        maybeDirectiveNames: uniq(maybeDirectives).map((x) => camelCase(x.toLowerCase())),
    };
}
