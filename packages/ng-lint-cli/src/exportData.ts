import fs from 'fs';

import type { ExportedExpressionAttrsData } from '@ng-helper/shared/lib/exportData';
import type { NgAllComponentsExpressionAttrsResponse } from '@ng-helper/shared/lib/plugin';

// 这里简单考虑，不做过多的校验
export function getExportedExpressionAttrsData(filePath: string): NgAllComponentsExpressionAttrsResponse | undefined {
    try {
        const jsonText = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(jsonText || '{}') as ExportedExpressionAttrsData;
        // 打印有多少个项目
        console.log(`读取组件/指令数据成功，共有 ${data.metadata.totalItems} 个组件/指令`);
        return data.expressionAttributes;
    } catch (error) {
        console.error(`读取组件/指令数据失败: ${error instanceof Error ? error.message : `${error as string}`}`);
    }
    return undefined;
}
