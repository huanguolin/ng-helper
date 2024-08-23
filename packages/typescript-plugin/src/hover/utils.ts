import { NgHoverInfo, type NgComponentNameInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext, SyntaxNodeInfoEx, type NgComponentFileInfo } from '../type';
import { createTmpSourceFile, getNodeAtPosition, getSymbolDocument, typeToString } from '../utils/common';

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

export function findComponentInfo(componentMap: Map<string, NgComponentFileInfo>, hoverInfo: NgElementHoverInfo) {
    let componentFilePath: string | undefined;
    let componentFileInfo: NgComponentNameInfo | undefined;
    let transcludeConfig: string | undefined;
    for (const [key, value] of componentMap.entries()) {
        if (value.componentName === hoverInfo.tagName) {
            componentFilePath = key;
            componentFileInfo = value;
            break;
        } else if (
            hoverInfo.parentTagName &&
            hoverInfo.parentTagName === value.componentName &&
            !!value.transclude &&
            typeof value.transclude === 'object'
        ) {
            for (const [, v] of Object.entries(value.transclude)) {
                const transcludeElementName = v.replace('?', '').trim();
                if (transcludeElementName === hoverInfo.tagName) {
                    componentFilePath = key;
                    componentFileInfo = value;
                    transcludeConfig = v;
                    break;
                }
            }
        }
    }
    return { componentFilePath, componentFileInfo, transcludeConfig };
}
