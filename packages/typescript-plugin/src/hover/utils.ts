import { NgHoverInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext } from '../type';
import { typeToString } from '../utils/common';

export function buildTypeInfo({ ctx, type, name }: { ctx: PluginContext; type: ts.Type; name: string }): NgHoverInfo {
    const isMethod = type.getCallSignatures().length > 0;
    const formattedTypeString = formatTypeString(ctx, type);
    const result: NgHoverInfo = {
        formattedTypeString: `(${isMethod ? 'method' : 'property'}) ${name}: ${formattedTypeString}`,
        // TODO document
        document: '',
    };
    return result;
}
function formatTypeString(ctx: PluginContext, type: ts.Type): string {
    const formatFlags = ctx.ts.TypeFormatFlags.NoTruncation | ctx.ts.TypeFormatFlags.NoTypeReduction;
    const formattedTypeString = typeToString(ctx, type, formatFlags)
        ?.replace(/;\s*/g, ';\n    ') // 对象属性分隔符后添加换行和缩进
        ?.replace(/{\s*/g, '{\n    ') // 对象起始大括号后添加换行和缩进
        ?.replace(/\s*}/g, '\n}'); // 对象结束大括号前添加换行;

    // TODO 格式化还是有问题
    return formattedTypeString ?? 'any';
}
