import { NgTypeInfo, type Parameter } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext, FileVersion, type CorePluginContext } from '../type';

export function createTmpSourceFile(
    ctx: PluginContext,
    codeText: string,
    name: string = 'tmp',
    setParentNodes?: boolean,
): ts.SourceFile {
    return ctx.ts.createSourceFile(
        `ng-helper///${name}.ts`,
        codeText,
        ctx.ts.ScriptTarget.ES5,
        setParentNodes,
        ctx.ts.ScriptKind.JS,
    );
}

export function getPropertyType(ctx: PluginContext, type: ts.Type, propertyName: string): ts.Type | undefined {
    return getPropertyTypeViaType(ctx, type, propertyName);
    // TODO 联合类型处理
    // else if (type.isUnion()) {
    //     const list = type.types.map((x) => getPropertyType(ctx, x, propertyName)).filter((x) => !!x) as ts.Type[];
    //     if (list.length === type.types.length) {
    //         return createUnionType(ctx, list);
    //     }
    // }
}

function getPropertyTypeViaType(ctx: PluginContext, type: ts.Type, propertyName: string): ts.Type | undefined {
    const symbol = type.getProperty(propertyName);
    if (!symbol || !symbol.valueDeclaration) {
        return;
    }

    // 排除非公开的
    const modifiers = ctx.ts.getCombinedModifierFlags(symbol.valueDeclaration);
    if (modifiers & ctx.ts.ModifierFlags.NonPublicAccessibilityModifier) {
        return;
    }

    return ctx.typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
}

/**
 * 判断类型是否是 typeof X。
 */
export function isTypeOfType(ctx: PluginContext, type: ts.Type): boolean {
    if (!type.symbol) {
        return false;
    }

    if (type.aliasTypeArguments) {
        return false;
    }

    return type !== ctx.typeChecker.getDeclaredTypeOfSymbol(type.symbol);
}

export function getSymbolDocument(ctx: PluginContext, symbol: ts.Symbol): string {
    return ctx.ts.displayPartsToString(symbol.getDocumentationComment(ctx.typeChecker));
}

export function getPublicMembersTypeInfoOfType(ctx: PluginContext, type: ts.Type): NgTypeInfo[] | undefined {
    // 处理联合类型
    if (type.isUnion()) {
        return getPublicMembersTypeInfoViaUnionType(ctx, type);
    }

    return getPublicMembersTypeInfoViaType(ctx, type);
}

function getPublicMembersTypeInfoViaUnionType(ctx: PluginContext, unionType: ts.UnionType): NgTypeInfo[] | undefined {
    // Get properties for each member of the union
    const memberPropertiesArray = unionType.types.map((t) => {
        const properties = getPublicMembersTypeInfoViaType(ctx, t);
        return properties || [];
    });

    if (memberPropertiesArray.length === 0) {
        return [];
    }

    // Create a map to track common properties
    const commonPropsMap = new Map<string, NgTypeInfo>();

    // Start with all properties from the first type
    const firstTypeProps = memberPropertiesArray[0];
    firstTypeProps.forEach((prop) => {
        commonPropsMap.set(prop.name, prop);
    });

    // For each subsequent type, keep only properties that exist in all types
    for (let i = 1; i < memberPropertiesArray.length; i++) {
        const currentTypeProps = memberPropertiesArray[i];
        const currentPropNames = new Set(currentTypeProps.map((p) => p.name));

        // Remove properties not found in current type
        for (const key of commonPropsMap.keys()) {
            if (currentPropNames.has(key)) {
                // TODO 如果类型一样，不用更新 typeString, 否则应该是两个类型的联合
                // 做这个时候考虑把 getPublicMembersTypeInfoViaType/getPublicMembersTypeInfoViaUnionType
                // 简化成返回类型数组，而不是 NgTypeInfo 数组，这样联合类型的 typeString 就能正确合并。
            } else {
                commonPropsMap.delete(key);
            }
        }

        // If no common properties remain, return empty array
        if (commonPropsMap.size === 0) {
            return [];
        }
    }

    return Array.from(commonPropsMap.values());
}

function getPublicMembersTypeInfoViaType(ctx: PluginContext, type: ts.Type): NgTypeInfo[] | undefined {
    const result = type
        .getApparentProperties()
        .map((x) => buildTypeInfo(ctx, x))
        .filter((x) => !!x);
    return result;
}

function buildTypeInfo(ctx: PluginContext, memberSymbol: ts.Symbol): NgTypeInfo | undefined {
    if (!memberSymbol.valueDeclaration) {
        return;
    }

    const modifiers = ctx.ts.getCombinedModifierFlags(memberSymbol.valueDeclaration);
    if (modifiers & ctx.ts.ModifierFlags.NonPublicAccessibilityModifier) {
        return;
    }

    const memberName = memberSymbol.getName();
    // angular.js 内部方法属性过滤掉
    // js 内部方法属性以 __ 开头的
    if (memberName.startsWith('$') || memberName.startsWith('__')) {
        return;
    }

    const memberType = ctx.typeChecker.getTypeOfSymbolAtLocation(memberSymbol, memberSymbol.valueDeclaration);
    if (memberSymbol.flags & (ctx.ts.SymbolFlags.Method | ctx.ts.SymbolFlags.Property)) {
        let item: NgTypeInfo = {
            kind: 'property',
            name: memberName,
            typeString: ctx.typeChecker.typeToString(memberType),
            document: getSymbolDocument(ctx, memberSymbol),
            isFunction: false,
            isFilter: false,
        };
        const signatures = memberType.getCallSignatures();
        if (signatures.length > 0) {
            const signature = signatures[0];
            const paramNames = signature.parameters.map((x) => x.getName());
            item = {
                ...item,
                kind: 'method',
                isFunction: true,
                paramNames,
            };
        }
        return item;
    }
}

export function typeToString(ctx: PluginContext, type?: ts.Type, formatFlags?: ts.TypeFormatFlags): string | undefined {
    return type ? ctx.typeChecker.typeToString(type, undefined, formatFlags) : undefined;
}

export function isCommaListExpression(ctx: PluginContext, node: ts.Node): node is ts.CommaListExpression {
    if (typeof ctx.ts.isCommaListExpression === 'function') {
        return ctx.ts.isCommaListExpression(node);
    }

    if (ctx.ts.isBinaryExpression(node)) {
        return node.operatorToken.kind === ctx.ts.SyntaxKind.CommaToken;
    }
    return false;
}

/**
 * 兼容 TS 3.5.3 的 getTypeArguments 实现
 * (getTypeArguments 似乎是 3.7 版本引入的，https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#37-api-changes)
 */
export function getTypeArguments(ctx: PluginContext, typeRef: ts.TypeReference): readonly ts.Type[] {
    if (typeof ctx.typeChecker.getTypeArguments === 'function') {
        return ctx.typeChecker.getTypeArguments(typeRef);
    }

    // 尝试使用不同的方式获取类型参数

    // 1. 直接从 typeRef 获取类型参数（内部API，但在 TS 3.5.3 可能存在）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const typeRefAny = typeRef as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeRefAny.typeArguments && Array.isArray(typeRefAny.typeArguments)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return typeRefAny.typeArguments as ts.Type[];
    }

    // 2. 通过 target 获取类型参数
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeRefAny.target && typeRefAny.target.typeArguments && Array.isArray(typeRefAny.target.typeArguments)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return typeRefAny.target.typeArguments as ts.Type[];
    }

    // 3. 处理元组类型
    if (ctx.typeChecker.isTupleType(typeRef)) {
        try {
            // 尝试获取元组的元素类型
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const tupleTypesAny = (typeRef as any).tupleTypes;
            if (tupleTypesAny && Array.isArray(tupleTypesAny)) {
                return tupleTypesAny as ts.Type[];
            }
        } catch (e) {
            // 忽略错误，继续尝试其他方法
        }
    }

    // 4. 处理数组类型
    if (ctx.typeChecker.isArrayLikeType(typeRef)) {
        try {
            // 尝试使用 TypeChecker 的非公开方法获取数组元素类型
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
            const checker = ctx.typeChecker as any;
            let elementType: ts.Type | undefined;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (typeof checker.getElementTypeOfArrayType === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                elementType = checker.getElementTypeOfArrayType(typeRef) as ts.Type;
            }

            // 备选方案：通过索引访问类型获取元素类型
            if (!elementType) {
                elementType = typeRef.getNumberIndexType();
            }

            if (elementType) {
                return [elementType];
            }
        } catch (e) {
            // 忽略错误
        }
    }

    // 如果上述所有方法都失败，返回空数组
    return [];
}

/**
 * 兼容 TS 3.5.3 的 getNumberLiteralType 实现
 * (getNumberLiteralType 似乎是 5.1 版本引入的, 这个是自己测试出来的)
 */
export function getNumberLiteralType(ctx: PluginContext, numValue: number): ts.Type | undefined {
    // Check if getNumberLiteralType exists in the TypeChecker
    if (typeof ctx.typeChecker.getNumberLiteralType === 'function') {
        return ctx.typeChecker.getNumberLiteralType(numValue);
    } else {
        // Fallback for older TypeScript versions

        // Define interfaces for internal TypeScript APIs to avoid 'any'
        interface InternalTypeChecker extends ts.TypeChecker {
            createLiteralType?(value: number): ts.Type;
            createFreshLiteralType?(value: number): ts.Type;
        }

        const internalChecker = ctx.typeChecker as InternalTypeChecker;

        // Option 1: Use createLiteralType if available
        if (typeof internalChecker.createLiteralType === 'function') {
            return internalChecker.createLiteralType(numValue);
        }

        // Option 2: Create fresh numeric literal type
        if (typeof internalChecker.createFreshLiteralType === 'function') {
            return internalChecker.createFreshLiteralType(numValue);
        }

        // Option 3: Get the type from a literal node by creating a temporary syntax tree
        // Instead of using createNumericLiteral which might not be available,
        // create a synthetic source file with the numeric literal
        const tempSourceFile = createTmpSourceFile(ctx, String(numValue), 'temp_for_getNumberLiteralType', true);

        // The first token in the source file should be our numeric literal
        if (
            tempSourceFile.statements.length > 0 &&
            tempSourceFile.statements[0].kind === ctx.ts.SyntaxKind.ExpressionStatement
        ) {
            const exprStatement = tempSourceFile.statements[0] as ts.ExpressionStatement;
            if (ctx.ts.isNumericLiteral(exprStatement.expression)) {
                return ctx.typeChecker.getTypeAtLocation(exprStatement.expression);
            }
        }

        // Fallback to default number type if all else fails
        return ctx.typeChecker.getNumberType();
    }
}

export function findClassDeclaration(ctx: PluginContext, node: ts.Node): ts.ClassDeclaration | undefined {
    if (ctx.ts.isClassDeclaration(node)) {
        return node;
    }

    return node.forEachChild((child: ts.Node) => findClassDeclaration(ctx, child));
}

export function getNodeAtPosition(
    ctx: PluginContext,
    position: number,
    sourceFile?: ts.SourceFile,
): ts.Node | undefined {
    sourceFile ??= ctx.sourceFile;

    // 处理 ng-repeat 的特殊情况，返回的是如 `items[0]` 这样的结果。
    if (position < 0 && ctx.ts.isExpressionStatement(sourceFile.statements[0])) {
        return sourceFile.statements[0].expression;
    }

    let foundNode: ts.Node | undefined;

    find(sourceFile);

    return foundNode;

    function find(node: ts.Node) {
        if (node.pos <= position && position < node.end) {
            foundNode = node;
            ctx.ts.forEachChild(node, find);
        }
    }
}

export function getLeftmostAccessExpression(ctx: PluginContext, expr: ts.Expression): ts.Expression {
    while (isAccessExpression(ctx, expr)) {
        expr = expr.expression;
    }
    return expr;
}

export function isAccessExpression(ctx: PluginContext, node: ts.Node): node is ts.AccessExpression {
    return (
        node.kind === ctx.ts.SyntaxKind.PropertyAccessExpression ||
        node.kind === ctx.ts.SyntaxKind.ElementAccessExpression
    );
}

export function getSourceFileVersion(sourceFile: ts.SourceFile): string {
    return (sourceFile as unknown as FileVersion).version;
}

export function getObjLiteral(
    coreCtx: CorePluginContext,
    objLiteral: ts.ObjectLiteralExpression,
): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const p of objLiteral.properties) {
        if (
            coreCtx.ts.isPropertyAssignment(p) &&
            coreCtx.ts.isIdentifier(p.name) &&
            coreCtx.ts.isStringLiteralLike(p.initializer)
        ) {
            obj[p.name.text] = p.initializer.text;
        }
    }
    return obj;
}

export function getPropValueByName(
    coreCtx: CorePluginContext,
    objLiteral: ts.ObjectLiteralExpression,
    propName: string,
): ts.Expression | undefined {
    const prop = getPropByName(coreCtx, objLiteral, propName);
    return prop?.initializer;
}

export function getPropByName(
    coreCtx: CorePluginContext,
    objLiteral: ts.ObjectLiteralExpression,
    propName: string,
): ts.PropertyAssignment | undefined {
    return getProp(coreCtx, objLiteral, (p) => p.name && coreCtx.ts.isIdentifier(p.name) && p.name.text === propName);
}

export function getProp(
    coreCtx: CorePluginContext,
    objLiteral: ts.ObjectLiteralExpression,
    predicate: (p: ts.PropertyAssignment) => boolean,
): ts.PropertyAssignment | undefined {
    return objLiteral.properties.find((p) => coreCtx.ts.isPropertyAssignment(p) && predicate(p)) as
        | ts.PropertyAssignment
        | undefined;
}

export function formatParameters(params: Parameter[]): string {
    return params.map((p) => p.name + (p.type ? `: ${p.type}` : '')).join(', ');
}

/**
 * 模拟 TypeScript 的 getUnionType 功能
 * 对于 TS 3.5.3 这类没有该方法的版本，提供一个兼容实现
 */
export function createUnionType(ctx: PluginContext, types: readonly ts.Type[]): ts.Type | undefined {
    if (types.length === 0) {
        return undefined;
    }

    if (types.length === 1) {
        return types[0];
    }

    // 1. 如果 TypeChecker 已经有 getUnionType，直接使用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const typeChecker = ctx.typeChecker as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof typeChecker.getUnionType === 'function') {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const unionType = typeChecker.getUnionType(types);
            if (unionType) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                return unionType as ts.Type;
            }
        } catch (e) {
            // 忽略错误
        }
    }

    // 2. 尝试使用内部 API
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const tsLib = ctx.ts as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof tsLib.getUnionType === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const unionType = tsLib.getUnionType(types);
            if (unionType) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                return unionType as ts.Type;
            }
        }
    } catch (e) {
        // 忽略错误
    }

    // 如果上述方法都失败，返回 undefined, 不能返回误导用户的类型
    return undefined;
}
