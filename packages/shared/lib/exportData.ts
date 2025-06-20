import type { NgAllComponentsExpressionAttrsResponse } from './plugin';

export interface ExportedExpressionAttrsData {
    timestamp: string;
    expressionAttributes: NgAllComponentsExpressionAttrsResponse;
    metadata: {
        totalItems: number;
        exportType: string;
        description: string;
    };
}
