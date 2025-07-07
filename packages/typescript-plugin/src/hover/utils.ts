import { SPACE } from '@ng-helper/shared/lib/html';
import {
    NgHoverInfo,
    type NgElementHoverInfo,
    type DirectiveInfo,
    type ComponentInfo,
    type Property,
    type NgTypeInfo,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import type { NgCache } from '../ngHelperTsService/ngCache';
import { getCtxOfCoreCtx } from '../ngHelperTsService/utils';
import { PluginContext, SyntaxNodeInfoEx, type CorePluginContext } from '../type';
import {
    createTmpSourceFile,
    getNodeAtPosition,
    getPublicMembersTypeInfoOfType,
    getSymbolDocument,
    typeToString,
} from '../utils/common';
import {
    getBindingName,
    getBindingType,
    getBindingTypeInfo,
    getComponentControllerType,
    INDENT,
    isElementDirective,
} from '../utils/ng';

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
    let parameters:
        | Array<{
              name: string;
              typeString: string;
              document: string;
          }>
        | undefined = undefined;
    if (targetType.isClass()) {
        typeKind = 'class';
    } else if (targetType.getCallSignatures().length > 0) {
        typeKind = 'method';
        const signature = targetType.getCallSignatures()[0];
        parameters = signature.parameters.map((x) => {
            const type = ctx.typeChecker.getTypeOfSymbolAtLocation(x, x.valueDeclaration ?? x.declarations![0]);
            return {
                name: x.name,
                typeString: formatTypeString(ctx, type),
                document: x.getDocumentationComment(ctx.typeChecker).toString(),
            };
        });
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
        isMethod: typeKind === 'method',
        parameters,
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
        const line = getLine();
        if (!line) {
            break;
        }

        const lineStartCh = line[0];
        if (lineStartCh === '}') {
            indent -= indentUnitCnt;
        }

        appendLine(line);

        const lineEndCh = line[line.length - 1];
        if (lineEndCh === '{') {
            indent += indentUnitCnt;
        }
    }
    return beautifulLines.join('\n');

    function getLine(): string {
        const start = index;
        let end = typeString.length;

        // 找到行结束符 '{' 或者 ';'
        while (index < typeString.length) {
            const ch = typeString[index];
            index++;
            if (ch === '{' || ch === ';') {
                end = index;
                break;
            }
        }

        // 跳过后续空格, 直到遇到一个非空格
        while (index < typeString.length) {
            const ch = typeString[index];
            if (ch !== SPACE) {
                break;
            }
            index++;
        }

        return typeString.slice(start, end);
    }

    function appendLine(line: string) {
        beautifulLines.push(SPACE.repeat(indent) + line.trim());
    }
}

export function getMinSyntaxNodeForHover(
    ctx: PluginContext,
    contextString: string,
    cursorAt: number,
): SyntaxNodeInfoEx | undefined {
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

/**
 * 查找组件或指令（用作元素使用时）信息
 * @param cache 缓存
 * @param hoverInfo 元素悬停信息
 * @returns 组件或指令信息
 */
export function findComponentOrDirectiveInfo(
    cache: NgCache,
    hoverInfo: NgElementHoverInfo,
): {
    componentInfo?: ComponentInfo;
    directiveInfo?: DirectiveInfo;
    transcludeConfig?: string;
} {
    const componentMap = cache.getComponentMap();
    if (componentMap.has(hoverInfo.tagName)) {
        return { componentInfo: componentMap.get(hoverInfo.tagName) };
    }

    const directiveMap = cache.getDirectiveMap();
    if (directiveMap.has(hoverInfo.tagName)) {
        const directiveInfo = directiveMap.get(hoverInfo.tagName)!;
        if (isElementDirective(directiveInfo)) {
            return { directiveInfo };
        }
    }

    if (hoverInfo.parentTagName) {
        if (componentMap.has(hoverInfo.parentTagName)) {
            const componentInfo = componentMap.get(hoverInfo.parentTagName)!;
            if (Array.isArray(componentInfo.transclude) && componentInfo.transclude.length > 0) {
                for (const item of componentInfo.transclude) {
                    const transcludeElementName = item.value.replace('?', '').trim();
                    if (transcludeElementName === hoverInfo.tagName) {
                        return { componentInfo, transcludeConfig: item.value };
                    }
                }
            }
        } else if (directiveMap.has(hoverInfo.parentTagName)) {
            const directiveInfo = directiveMap.get(hoverInfo.parentTagName)!;
            if (
                isElementDirective(directiveInfo) &&
                Array.isArray(directiveInfo.transclude) &&
                directiveInfo.transclude.length > 0
            ) {
                for (const item of directiveInfo.transclude) {
                    const transcludeElementName = item.value.replace('?', '').trim();
                    if (transcludeElementName === hoverInfo.tagName) {
                        return { directiveInfo, transcludeConfig: item.value };
                    }
                }
            }
        }
    }

    return {};
}

export function getComponentNameHoverInfo(coreCtx: CorePluginContext, componentInfo: ComponentInfo) {
    const component = `(component) ${componentInfo.name}`;

    const bindingTypeMap = getComponentBindingTypeMap(coreCtx, componentInfo) ?? new Map<string, NgTypeInfo>();
    const bindings = formatLiteralObj(
        'bindings',
        componentInfo.bindings,
        (x) => bindingTypeMap.get(x.name)?.typeString ?? '',
    );
    const transclude = formatTransclude(componentInfo.transclude);

    return {
        formattedTypeString: [component, bindings, transclude].filter((x) => !!x).join('\n'),
        document: '',
    };
}

export function getComponentAttrHoverInfo(coreCtx: CorePluginContext, attrName: string, componentInfo: ComponentInfo) {
    const binding = componentInfo.bindings.find((x) => getBindingName(x) === attrName);
    if (!binding) {
        return;
    }

    const bindingTypeInfo = getBindingTypeInfo(binding, true);
    const result = {
        formattedTypeString: `(property) ${attrName}: ${bindingTypeInfo.typeString}`,
        document: bindingTypeInfo.document, // document 放着 binding 的配置
    };

    const bindingTypeMap = getComponentBindingTypeMap(coreCtx, componentInfo) ?? new Map<string, NgTypeInfo>();
    if (bindingTypeMap.has(binding.name)) {
        const typeInfo = bindingTypeMap.get(binding.name)!;
        result.formattedTypeString = `(property) ${attrName}: ${beautifyTypeString(typeInfo.typeString)}`;
        if (typeInfo.document) {
            result.document += `\n${typeInfo.document}`;
        }
    }

    return result;
}

function getComponentBindingTypeMap(coreCtx: CorePluginContext, componentInfo: ComponentInfo) {
    if (componentInfo.bindings.length === 0) {
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, componentInfo.filePath);
    if (!ctx) {
        return;
    }

    const controllerType = getComponentControllerType(ctx, componentInfo.name);
    if (!controllerType) {
        return;
    }

    const types = getPublicMembersTypeInfoOfType(ctx, controllerType);
    if (!types) {
        return;
    }

    return new Map(types.map((x) => [x.name, x]));
}

export function getDirectiveAttrHoverInfo(
    attrName: string,
    directiveInfo: DirectiveInfo,
    isAttrDirectiveStyle: boolean,
) {
    const attr = directiveInfo.scope.find((x) => getBindingName(x) === attrName);
    if (!attr) {
        return;
    }

    const prefix = isAttrDirectiveStyle ? `attribute of [${directiveInfo.name}]` : 'property';
    const attrInfo = `(${prefix}) ${attr.name}: ${getBindingType(attr.value, true)}`;
    const scopeInfo = `scope configs: "${attr.value}"`;

    return {
        formattedTypeString: attrInfo,
        document: scopeInfo,
    };
}

export function getDirectiveNameHoverInfo(directiveInfo: DirectiveInfo) {
    const directive = `(directive) ${directiveInfo.name}`;
    const others = getOtherProps(['restrict', 'replace', 'require', 'priority', 'terminal']);
    const formattedTypeString = [
        directive,
        ...others,
        formatLiteralObj('scope', directiveInfo.scope),
        formatTransclude(directiveInfo.transclude),
    ]
        .filter((x) => !!x)
        .join('\n');

    return {
        formattedTypeString,
        document: '',
    };

    function getOtherProps(propNames: (keyof DirectiveInfo)[]): string[] {
        return propNames.map((p) => {
            const v = directiveInfo[p] as string | boolean | number;
            if (!v) {
                return '';
            } else if (typeof v === 'string') {
                return `${p}: "${v}"`;
            } else {
                return `${p}: ${v}`;
            }
        });
    }
}

function formatLiteralObj(objName: string, objProps: Property[], getComment?: (prop: Property) => string) {
    if (objProps.length === 0) {
        return `${objName}: { }`;
    }
    return `${objName}: {\n${formatLiteralObjProps(objProps, getComment)}\n}`;
}

function formatLiteralObjProps(objProps: Property[], getComment?: (prop: Property) => string) {
    return objProps
        .map((p) => {
            const basicPart = `${INDENT}${p.name}: "${p.value}"`;
            let comment = '';
            if (getComment) {
                const c = getComment(p).trim();
                if (c) {
                    comment = ` // ${c}`;
                }
            }
            return basicPart + comment;
        })
        .join('\n');
}

function formatTransclude(transclude: DirectiveInfo['transclude']) {
    let transcludeString = '';
    if (Array.isArray(transclude)) {
        transcludeString = `transclude: {\n${formatLiteralObjProps(transclude)}\n}`;
    } else if (transclude) {
        transcludeString = `transclude: true`;
    }
    return transcludeString;
}
