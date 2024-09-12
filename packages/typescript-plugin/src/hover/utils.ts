import { NgHoverInfo, type NgComponentNameInfo, type NgDirectiveNameInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext, SyntaxNodeInfoEx, type NgComponentDirectiveFileInfo } from '../type';
import { createTmpSourceFile, getNodeAtPosition, getSymbolDocument, typeToString } from '../utils/common';
import { isElementDirective } from '../utils/ng';

export function buildHoverInfo({
    ctx,
    targetType,
    name,
    parentType,
}: {
    ctx: PluginContext;
    targetType: ts.Type;
    name: string;
    parentType?: ts.Type;
}): NgHoverInfo {
    let typeKind = 'property';
    if (targetType.isClass()) {
        typeKind = 'class';
    } else if (targetType.getCallSignatures().length > 0) {
        typeKind = 'method';
    }

    let document = '';
    if (parentType) {
        const memberSymbol = parentType.getProperty(name);
        if (memberSymbol && memberSymbol.valueDeclaration) {
            document = getSymbolDocument(ctx, memberSymbol);
        }
    }

    return {
        formattedTypeString: `(${typeKind}) ${name}: ${formatTypeString(ctx, targetType)}`,
        document,
    };
}

export function formatTypeString(ctx: PluginContext, type: ts.Type): string {
    const formatFlags = ctx.ts.TypeFormatFlags.NoTruncation | ctx.ts.TypeFormatFlags.NoTypeReduction;
    // typeToString 无法处理换行美化，所以要用 beautifyTypeString 处理一下
    const typeString = typeToString(ctx, type, formatFlags);
    return beautifyTypeString(typeString ?? 'any');
}

export function beautifyTypeString(typeString: string): string {
    const beautifulLines: string[] = [];
    const indentUnitCnt = 4;
    let index = 0;
    let indent = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { line, endCh } = getLine();
        if (!line) {
            break;
        }

        if (endCh === '{') {
            appendLine(line);
            indent += indentUnitCnt;
        } else if (endCh === '}' || endCh === '};') {
            indent -= indentUnitCnt;
            appendLine(line);
        } else {
            appendLine(line);
        }
    }
    return beautifulLines.join('\n');

    function getLine(): { line: string; endCh: string } {
        const start = index;
        while (index < typeString.length) {
            const ch = typeString[index];
            if (ch === '}' && typeString[index + 1] === ';') {
                index += 2;
                return {
                    line: typeString.slice(start, index),
                    endCh: '};',
                };
            } else if (ch === '{' || ch === '}' || ch === ';') {
                index += 1;
                return {
                    line: typeString.slice(start, index),
                    endCh: ch,
                };
            } else {
                index += 1;
            }
        }
        return {
            line: typeString.slice(start),
            endCh: '',
        };
    }

    function appendLine(line: string) {
        beautifulLines.push(' '.repeat(indent) + line.trim());
    }
}

export function getMinSyntaxNodeForHover(ctx: PluginContext, contextString: string, cursorAt: number): SyntaxNodeInfoEx | undefined {
    const sourceFile = createTmpSourceFile(ctx, contextString, 'tmp', /* setParentNodes */ true);
    const node = getNodeAtPosition(ctx, cursorAt, sourceFile);

    if (!node) {
        return;
    }

    if (node.parent && ctx.ts.isPropertyAccessExpression(node.parent) && node !== node.parent.expression) {
        return { sourceFile, minNode: node.parent, targetNode: node };
    } else {
        return { sourceFile, minNode: node, targetNode: node };
    }
}

export function findComponentOrDirectiveInfo(
    componentDirectiveMap: Map<string, NgComponentDirectiveFileInfo>,
    hoverInfo: NgElementHoverInfo,
): {
    filePath?: string;
    componentNameInfo?: NgComponentNameInfo;
    directiveNameInfo?: NgDirectiveNameInfo;
    transcludeConfig?: string;
} {
    for (const [key, value] of componentDirectiveMap.entries()) {
        const componentInfo = findFromComponents(value.components);
        if (componentInfo) {
            return { filePath: key, ...componentInfo };
        }
        const directiveInfo = findFromDirectives(value.directives);
        if (directiveInfo) {
            return { filePath: key, ...directiveInfo };
        }
    }
    return {};

    function findFromDirectives(directives: NgDirectiveNameInfo[]):
        | {
              directiveNameInfo: NgDirectiveNameInfo;
              transcludeConfig?: string;
          }
        | undefined {
        for (const directive of directives) {
            if (!isElementDirective(directive)) {
                continue;
            }

            if (directive.directiveName === hoverInfo.tagName) {
                return { directiveNameInfo: directive };
            } else if (
                hoverInfo.parentTagName &&
                hoverInfo.parentTagName === directive.directiveName &&
                !!directive.transclude &&
                typeof directive.transclude === 'object'
            ) {
                for (const [, v] of Object.entries(directive.transclude)) {
                    const transcludeElementName = v.replace('?', '').trim();
                    if (transcludeElementName === hoverInfo.tagName) {
                        return { directiveNameInfo: directive, transcludeConfig: v };
                    }
                }
            }
        }
    }

    function findFromComponents(components: NgComponentNameInfo[]):
        | {
              componentNameInfo: NgComponentNameInfo;
              transcludeConfig?: string;
          }
        | undefined {
        for (const component of components) {
            if (component.componentName === hoverInfo.tagName) {
                return { componentNameInfo: component };
            } else if (
                hoverInfo.parentTagName &&
                hoverInfo.parentTagName === component.componentName &&
                !!component.transclude &&
                typeof component.transclude === 'object'
            ) {
                for (const [, v] of Object.entries(component.transclude)) {
                    const transcludeElementName = v.replace('?', '').trim();
                    if (transcludeElementName === hoverInfo.tagName) {
                        return { componentNameInfo: component, transcludeConfig: v };
                    }
                }
            }
        }
    }
}
